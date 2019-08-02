'use strict'
console.log("payment-requests.js");

console.log("Load: TemplateRenderer");
const template = require('./lib/TemplateRenderer')
console.log("Load: Response");
const Response = require('./lib/Response')
console.log("Load: BaseHandler");
const BaseHandler = require('./lib/BaseHandler')
console.log("Load: querystring");
const querystring = require('querystring')
console.log("Load: uuid/v1");
const uuidv1 = require('uuid/v1')
console.log("Load: moment");
const moment = require('moment')
console.log("Load: aws-sdk");
const AWS = require('aws-sdk')
console.log("Load: PaymentRequest");
const PaymentRequest = require('./lib/PaymentRequest.js').PaymentRequest
console.log("Load: SESEmailNotification");
const EmailNotification = require('./lib/SESEmailNotification.js').SESEmailNotification
console.log("Load: AuthenticatorMiddleware");
const authenticatorMiddleware = require('./middleware/authenticate');

// The company name from the settings, for the email notifications.
const company = process.env.COMPANY_NAME

console.log("Dependencies Ready");

// * ====================================== *
// * HANDLERS
// * ====================================== *



/*
=================================================
 [GET] PAYMENT REQUESTS HANDLER
=================================================
*/

let indexHandler = new BaseHandler("index").willDo(
  async function (event, context) {
    var templateParameters

    try {
      // If a payment request ID and created_at time stamp was provided as
      // parameters, then show that payment request instead of the list.
      if (event.queryStringParameters &&
        event.queryStringParameters.id &&
        event.queryStringParameters.created_at) {
        var id = event.queryStringParameters.id
        var created_at = event.queryStringParameters.created_at
        templateParameters = await PaymentRequest.get(id, created_at)
        templateParameters.payment_id = templateParameters.payment.id
        templateParameters.paid_at_moment = function () {
          return moment(this.paid_at).fromNow()
        }

        let routes = await template.getRoutes();
        templateParameters.additional_fields_partial = "";
        if(
          templateParameters.additional_fields &&
          templateParameters.additional_fields != "none"
          && routes.forms.partials[templateParameters.additional_fields]
        ){
          templateParameters.additional_fields_partial = await template.renderPartial("forms/"+templateParameters.additional_fields,templateParameters);
        }

        return new Response('200').send(
          await template.render('payment-request', templateParameters))
      }
      else {
        var paymentRequests = await PaymentRequest.index()

        templateParameters = {
          'paymentRequests': paymentRequests,
          'created_at_escaped': function () {
            return encodeURIComponent(this.created_at)
          },
          "created_at_moment": function () {
            return moment(this.created_at).fromNow()
          }
        }

        return new Response('200').send(
          await template.render('payment-requests', templateParameters))
      }
    }
    catch (error) {
      return new Response('200').send(
        await template.render('error', { 'error': error }))
    }
  }
)

indexHandler.middleware(authenticatorMiddleware);

/*
=================================================
 [GET] NEW PAYMENT REQUEST HANDLER
=================================================
*/

let newHandler = new BaseHandler("new").willDo(
  async function (event, context) {
    console.log("\nNew Handler\n");
    let routes = await template.getRoutes();
    let fields = Object.keys(routes.forms.partials)
      .map( k => ({
        value : k,
        label : k.replace('fields-','').replace(/\-/gi,' ')
      }) );
    for(let i = 0; i < fields.length; i++){
      fields[i].partial = await template.renderPartial("forms/"+fields[i].value)
    }
    let templateParameters = { fields };

    console.log("new.templateParameters",templateParameters);

    return new Response('200').send(
      await template.render('payment-request-form',templateParameters))
  }
)

newHandler.middleware(authenticatorMiddleware);


/*
=================================================
 [POST] NEW PAYMENT REQUEST HANDLER
=================================================
*/


let postHandler = new BaseHandler("post").willDo(
  async function (event, context) {

    // Create the payment request record
    var paymentRequest = querystring.parse(event.body)
    paymentRequest['id'] = uuidv1()

    try {
      await PaymentRequest.put(paymentRequest)
      var templateParameters = paymentRequest

      // This notification goes to the customer.
      templateParameters.subject = "Payment request from " + company
      templateParameters.to = paymentRequest.email
      var templateName = 'payment-request-email-to-customer'
      await EmailNotification.sendEmail(templateName, templateParameters)

      // This notification goes to the requestor.
      templateParameters.subject = "Payment request to " + paymentRequest.email
      templateParameters.to = paymentRequest.requestor
      templateName = 'payment-request-email-to-requestor'
      await EmailNotification.sendEmail(templateName, templateParameters)

      return new Response('200').send(
        await template.render('payment-request-confirmation', templateParameters))
    }
    catch (error) {
      return new Response('200').send(
        await template.render('error', { 'error': error }))
    }
  }
)
postHandler.middleware(authenticatorMiddleware);


/*
=================================================
 [GET] RESEND PAYMENT REQUEST HANDLER
=================================================
*/


let resendHandler = new BaseHandler("resend").willDo(
  async function (event, context) {
    try {
      var paymentRequest =
        await PaymentRequest.get(
          event.queryStringParameters.id,
          event.queryStringParameters.created_at)
      var templateParameters = paymentRequest

      // This notification goes to the customer.
      templateParameters.subject = "Payment request from " + company
      templateParameters.to = paymentRequest.email
      var templateName = 'payment-request-email-to-customer'
      await EmailNotification.sendEmail(templateName, templateParameters)

      return new Response('200').send(
        await template.render('payment-request-resent', templateParameters))
    }
    catch (error) {
      return new Response('200').send(
        await template.render('error', { 'error': error }))
    }
  }
)

resendHandler.middleware(authenticatorMiddleware);


// * ====================================== *
// * EXPORTS
// * ====================================== *

exports.index  = indexHandler.do
exports.new    = newHandler.do
exports.post   = postHandler.do
exports.resend = resendHandler.do
