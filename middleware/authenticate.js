'use strict'
const template = require('../lib/TemplateRenderer')
const Response = require('../lib/Response')
const APIGatewayAuthorizer = require('../lib/APIGatewayAuthorizer')
const CognitoAuthenticator = require('../lib/CognitoAuthenticator')
const Logger = require('../lib/Logger/log')

async function authenticate(event, context) {
  global.handler.authenticated = true;
  Logger.debug(["Trying to authenticate"])
  if (global.handler.skipAuthentication) {
    Logger.info(["Authenticator Middleware: Skipping authentication."]);
    global.handler.authenticated = true;
    return;
  }
  // Check for the access token cookie and verify it if it exists.
  var authenticationToken
  try {
    const authorizer = new APIGatewayAuthorizer()

    authenticationToken = await authorizer.getValidAuthenticationTokenFromCookie(event)
    Logger.info(["Access token requested..."]);

  }
  catch (error) {
    Logger.error(["Authenticate error:",error]);
    // Respond with login form if there is an error getting the access token.
    return new Response('200').send(
      await template.render('login')
    )
  }
  if (!authenticationToken) {
    Logger.info(["No access token, redirecting to login"]);
    // Respond with the login form if the access token is missing,
    // so that the user can provide their authentication credentials and
    // get a token.
    return new Response('200').send(
      await template.render('login')
    )
  } else {
    global.handler.authenticated = true;
  }

}

module.exports = authenticate;
