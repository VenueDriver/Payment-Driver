'use strict'
const fs = require('fs')
const template = require('./lib/TemplateRenderer/index')
const Response = require('./lib/Response/index')
const BaseHandler = require('./lib/BaseHandler/index')
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

let indexHandler = new BaseHandler("index").willDo(
  async function (event, context) {
    // Check for the access token cookie and verify it if it exists.
    var accessToken
    try {
      accessToken = await authorizer.getValidAccessTokenFromCookie(event)
    }
    catch (error) {
      // Respond with login form if there is an error getting the access token.
      return new Response('html').send(
        await template.render('login')
      )
    }
    if (!accessToken) {
      // Respond with the login form if the access token is missing,
      // so that the user can provide their authentication credentials and
      // get a token.
      return new Response('html').send(
        await template.render('login')
      )
    }

    return redirectToPaymentRequestsResponse(event)
  }
)


// Login handler
let loginHandler = new BaseHandler("login").willDo(
  async function (event, context) {
    const params = querystring.parse(event.body)

    var authResponse
    try {
      authResponse = await authenticator.authenticate({
        username: params.username,
        password: params.password
      })

      console.log("Successful Authentication.")

      if (authResponse.ChallengeName == 'NEW_PASSWORD_REQUIRED') {
        if (params.new_password) {
          console.log("last response: " + JSON.stringify(authResponse))
          authResponse = await authenticator.respondToAuthChallenge(authResponse, params.username, params.new_password)
          console.log("response: " + JSON.stringify(authResponse))
        }
        else {
          return new Response('html').send(
            await template.render('login', {
              'message': 'Please change your password to proceed.',
              'new_password': true, // Show the 'new password' field.
              'username': params.username,
              'password': params.password
            })
          )
        }
      }

      console.log("Verifying access token: " + authResponse.AuthenticationResult.AccessToken)
      await authenticator.verifyCognitoToken(authResponse.AuthenticationResult.AccessToken)
      return redirectToPaymentRequestsResponse(event, authResponse.AuthenticationResult.AccessToken)
    }
    catch (error) {
      return new Response('html').send(
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
    return {
      statusCode: 302,
      headers: {
        location: 'https://' + event.headers.Host + '/',
        // Remove the access token cookie.
        'Set-Cookie': 'access_token=; Expires=Mon, 30 Apr 2012 22:00:00 EDT'
      }
    }
  }
);



function redirectToPaymentRequestsResponse(event, accessToken) {
  var headers = { location: 'https://' + event.headers.Host + '/payment-requests' }
  if (accessToken) {
    // This is a session cookie, since it has no expiration set.
    headers['Set-Cookie'] = 'access_token = ' + accessToken + "; Secure; SameSite=Strict"
  }
  console.log("Redirecting: " + JSON.stringify(headers))
  return {
    statusCode: 302,
    headers: headers
  }
}

// * ====================================== *
// * EXPORTS
// * ====================================== *

exports.index   = indexHandler.do;
exports.login   = loginHandler.do;
exports.logout  = logoutHandler.do;