'use strict'
const template = require('./lib/TemplateRenderer')
const Response = require('./lib/Response')
const BaseHandler = require('./lib/BaseHandler')
const querystring = require('querystring')
const uuidv1 = require('uuid/v1')
const moment = require('moment')
const AWS = require('aws-sdk')
const PaymentRequest = require('./lib/PaymentRequest.js').PaymentRequest
const EmailNotification = require('./lib/SESEmailNotification.js').SESEmailNotification

// The company name from the settings, for the email notifications.
const company = process.env.COMPANY_NAME

// * ====================================== *
// * HANDLERS
// * ====================================== *

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

let newHandler = new BaseHandler("new").willDo(
  async function (event, context) {
    return new Response('200').send(
      await template.render('payment-request-form'))
  }
)

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
      await EmailNotification.sendEmail(templateName, global.handler.base_url, templateParameters)
  
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

let resendHandler = new BaseHandler("resend").willDo(
  async function (event, context) {

    try {
      var paymentRequest =
        await PaymentRequest.get(
          event.queryStringParameters.id,
          event.queryStringParameters.created_at)
      var templateParameters = paymentRequest
      
      // TODO: DRY this duplicate base_url computation code.
      // This is here because global.handler.base_url is not set yet.
      let pathRegex = new RegExp(event.requestContext.resourcePath+"$");
      let base_path = event.requestContext.path.replace(pathRegex,'');
      global.handler.base_url = `https://${event.headers['Host']}${base_path}/`;

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


// * ====================================== *
// * EXPORTS
// * ====================================== *

exports.index  = indexHandler.do
exports.new    = newHandler.do
exports.post   = postHandler.do
exports.resend = resendHandler.do