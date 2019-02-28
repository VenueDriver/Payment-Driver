'use strict'
const fs = require('fs')
const template = require('./lib/TemplateRenderer')
const Response = require('./lib/Response')
const BaseHandler = require('./lib/BaseHandler')
const querystring = require('querystring')
const uuidv1 = require('uuid/v1')
const mustache = require('mustache')
const moment = require('moment')

// Load environment variables and override anything already set.
const dotenv = require('dotenv')
try {
  const envConfig = dotenv.parse(fs.readFileSync('.env'))
  for (var k in envConfig) { process.env[k] = envConfig[k] }
}
catch (err) {
  // There will not be a .env file in production.
}

const partials = require('./partial-html-templates')
const PaymentRequest = require('./lib/PaymentRequest.js').PaymentRequest
const EmailNotification = require('./lib/SESEmailNotification.js').SESEmailNotification
const APIGatewayAuthorizer = require('./lib/APIGatewayAuthorizer.js')

// The company name from the settings, for the email notifications.
const company = process.env.COMPANY_NAME

const CognitoAuthenticator = require('./lib/CognitoAuthenticator.js')
const userPoolId = process.env.USER_POOL_ID
const region = process.env.AWS_REGION
const clientId = process.env.CLIENT_ID
const authenticator = new CognitoAuthenticator(region, userPoolId, clientId)
const authorizer = new APIGatewayAuthorizer()

// * ====================================== *
// * HANDLERS
// * ====================================== *

// Index handler
// This is the home page of the app.
// If you're not authenticated then you will be asked to log in.
// If you're authenticated then you will be redirected to the management UI.
let indexHandler = new BaseHandler("index").willDo(
  async function (event, context) {
    // Check for the access token cookie and verify it if it exists.
    var accessToken
    try {
      accessToken = await authorizer.getValidAccessTokenFromCookie(event)
    }
    catch (error) {
      // Respond with login form if there is an error getting the access token.
      return new Response('200').send(
        await template.render('login')
      )
    }
    if (!accessToken) {
      // Respond with the login form if the access token is missing,
      // so that the user can provide their authentication credentials and
      // get a token.
      return new Response('200').send(
        await template.render('login')
      )
    }

    // Redirect to the home of the authenticated management area if the
    // token is detected and valid.
    return redirectToPaymentRequestsResponse(event, accessToken)
  }
)


// Login handler
// If you provide valid credentials but you need to change your password
// according to Cognito, then you will see a form to change your password.
// If you provide valid credentials and you do not need to change your password,
// then you will be redirected to the management UI.
let loginHandler = new BaseHandler("login").willDo(
  async function (event, context) {
    const params = querystring.parse(event.body)

    var authResponse
    try {
      authResponse = await authenticator.authenticate({
        username: params.username,
        password: params.password
      })

      if (authResponse.ChallengeName == 'NEW_PASSWORD_REQUIRED') {
        if (params.new_password) {
          authResponse =
            await authenticator.respondToAuthChallenge(
              authResponse, params.username, params.new_password)
        }
        else {
          return new Response('200').send(
            await template.render('login', {
              'message': 'Please change your password to proceed.',
              'new_password': true, // Show the 'new password' field.
              'username': params.username,
              'password': params.password
            })
          )
        }
      }

      // Verify access token.
      await authenticator.verifyCognitoToken(
        authResponse.AuthenticationResult.AccessToken)
      // TODO: This should only happen if the token was valid.
      return redirectToPaymentRequestsResponse(event,
        authResponse.AuthenticationResult.AccessToken)
    }
    catch (error) {
      return new Response('200').send(
        await template.render('login', {
          'message': error,
          'username': params.username,
          'password': params.password
        })
      )
    }
  }
)


// Logout handler
let logoutHandler = new BaseHandler("logout").willDo(
  async function (event, context) {
    return new Response('302').send({
      headers: {
        location: 'https://' + event.headers.Host + '/',
        // Remove the access token cookie.
        'Set-Cookie': 'access_token=; Expires=Mon, 30 Apr 2012 22:00:00 EDT'
      }
    })
  }
)


// * ====================================== *
// * FUNCTIONS
// * ====================================== *

function redirectToPaymentRequestsResponse(event, accessToken) {
  return new Response('302').send({
    headers: {
      // The home path of the authenticated management section.
      location: 'https://' + event.headers.Host + '/payment-requests',
      // Add the authentication token as a cookie.
      'Set-Cookie':
        // This is a session cookie, since it has no expiration set.
        'access_token = ' + accessToken + "; Secure; SameSite=Strict"
    }
  })
}

// * ====================================== *
// * EXPORTS
// * ====================================== *

exports.index   = indexHandler.do
exports.login   = loginHandler.do
exports.logout  = logoutHandler.do
