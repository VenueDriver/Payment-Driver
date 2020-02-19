const PaymentRequestAuthorizer = require('../lib/PaymentRequestAuthorizer');
const Response = require('../lib/Response')

async function bypassNewPaymentRequestAuthenticator(event, context) {
  if(process.env.DEBUG){
  console.log("\nBypassNewPaymentRequestAuthenticator\n"); }
  const authorizer = new PaymentRequestAuthorizer();

  let paymentRequestRequestPayload = null;

  try {
    let accessToken = authorizer.getValidAccessTokenFromQueryParams(event);
    paymentRequestRequestPayload = authorizer.decode(accessToken);
    if(paymentRequestRequestPayload){
      global.handler.paymentRequestRequestPayload = paymentRequestRequestPayload;
      if(process.env.DEBUG){
        console.log("Token Payload:",global.handler.paymentRequestRequestPayload); }
      global.handler.queryParams = `?payment-request-token=${accessToken}`;
      global.handler.skipAuthentication = true;
    }
  }
  catch (error) {
    console.log(error);
  }

  if(!paymentRequestRequestPayload){
    return new Response('302').redirect('payment-requests')
  }
}

module.exports = bypassNewPaymentRequestAuthenticator;
