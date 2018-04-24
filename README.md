Welcome to the AWS CodeStar sample web application
==================================================

This sample code helps get you started with a simple Node.js web service deployed by AWS CloudFormation to AWS Lambda and Amazon API Gateway.

What's Here
-----------

This sample includes:

* README.md - this file
* buildspec.yml - this file is used by AWS CodeBuild to package your
  application for deployment to AWS Lambda
* index.js - this file contains the sample Node.js code for the web service
* template.yml - this file contains the Serverless Application Model (SAM) used
  by AWS Cloudformation to deploy your application to AWS Lambda and Amazon API
  Gateway.

Development
-----------

### Set up Stripe keys

Be sure to set the Stripe keys as environment variables:

    STRIPE_PUBLISHABLE_KEY
    STRIPE_SECRET_KEY

Example ~/.bash_profile code:

    export STRIPE_PUBLISHABLE_KEY="pk_..."
    export STRIPE_SECRET_KEY="sk_..."

Get the keys from the Stripe dashboard.

### Set up local DynamoDB tables

At the time that this was written, SAM Local cannot manage local DynamoDB tables for development.  You have to set them up manually.

First, you will need DynamoDB Local:

https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html

First, create a network for SAM Local to reach your local DynamoDB:

    docker network create sam-local

Then install and run DynamoDB Local, on that Docker network:

    docker run -d -v "$PWD":/dynamodb_local_db -p 8000:8000 --network sam-local --name dynamodb cnadiminti/dynamodb-local

If you have already done that once and downloaded the DynamoDB container before, then you can run the existing container with:

    docker start dynamodb

Once you have DynamoDB running on port 8000, create some tables:

    npm run create-tables

If you need to drop those tables and re-create them, then do this:

    npm run delete-tables

To scan the current contents of your ```payment_requests``` table:

    aws dynamodb scan --endpoint-url http://localhost:8000 --table-name payment_requests

### Start an asset server

Run this:

    node-http-server root=public port=8081 verbose=true

### Start an HTTP server with SAM Local

Use SAM Local for development:

    sam local start-api -p 8080 --env-vars env.json --docker-network sam-local --static-dir ""

Port 8080 is important if you're using AWS Cloud9.

The ```--env-vars``` parameter loads environment variables from the ```env.json``` file.

The ```-docker-network``` parameter enables it to connect to the DynamoDB container.  SAM Local runs in a container, so without this you can't connect to the database.

The ```--static-dir ""``` parameter stops SAM Local from mounting the ```public``` folder on ```/``` on the HTTP server.  This project has a dynamic response on that URL path.  That's why you need to run the HTTP server for assets, when normally you could use SAM Local for that.

### Go to the app in a web browser

To reach the form for the first user story, go to ```http://localhost:8080/payment-request-form.html```

To do a test Stripe transaction, ensure that your Stripe keys are set as described above.  Then send a GET request to the ```/payments``` REST resource: ```http://localhost:8080/payments```

Development
-----------

### Generate documentation

    documentation build lib/** -f html -o documentation/

User stories
------------

### Employee sends payment request

    Scenario: As an employee, I want to send a payment request email to a customer, so that they can pay us

    Given that I an an employee with a valid user account in the system,
    When I log into the employee dashboard,
    Then I should see an option to send a payment request,
    And when I follow that option,
    Then I should see a form for making a payment,
    And the form should include First, Last, Email, venue, event date,
    And the form should include a currency amount in USD,
    And when I fill out the form and submit it,
    Then a notification should be sent to the customer,
    And the notification should include a link to a payment form,
    And a record of the payment request should be written to the database,
    And then I should see a confirmation page in the dashboard.

#### Implementation

The ```/public/payment-form.html``` file is sent to S3 by AWS CodeBuild using the buildspec.yml file.  The build uses the ```sed``` utility to replace ```assets``` with the URL to the S3 bucket where the assets are stored.

This will need an authentication system.

### Employee wants to cancel payment request

    Scenario: As an employee, I want to cancel a payment request which was already sent to a customer but not filled out and submitted yet

    Given that I an an employee with a valid user account in the system,
    When I log into the employee dashboard,
    Assuming I have previously generated at least one payment request,
    Then I should see a list of requests,
    And each request should have a status (sent/pending/closed),
    And each request should have a CANCEL option,
    So when I click CANCEL,
    The customer receives and email explaining that the request was canceled

#### Implementation

Not yet implemented.

### Customer makes payment

  Scenario: As a customer, I want to follow a payment request link and submit my information, so that I can make a payment

  The first release would only include those two user stories.
  The second release could include payment request management.
  Probably need to tweak the stories to include details like: The payment request record should be tagged to the user and venue.
  There is another issue that's not really a user story.  User stories are super useful but you can't use them for everything.
  We want the venue list to use some standard venue list, rather than this thing having its own list of venues that we have to maintain.
  The cleanest thing would be to get that from Vault.
  But Vault has no API.  And that's kind of a touchy thing in terms of security to add one.
  We could set this up to use Venue Driver venue IDs, but it doesn't know venue IDs for restaurants.
  We might actually have to have a venues table in this thing.  And it might be called "accounts" instead of "venues".

#### Implementation

The ```payments``` REST resource is powered by the ```payments.js``` Lambda functions.

The REST resource supports these HTTP verbs:

##### GET

Loads the file ```views/payment-form.html```, processes it with Moustache to add details from the payment request and the Stripe key, and serves the HTML.

##### POST

Processes a payment with Stripe.