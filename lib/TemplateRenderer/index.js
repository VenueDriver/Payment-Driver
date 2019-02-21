const partials    = require('./partials');
const templates   = require('./templates');
const mustache    = require('mustache');
const load        = require('./load');
const urljoin     = require('url-join')

class TemplateRenderer {

  constructor(){
    this.templates  = {};
    this.partials   = null;
    this.load       = load;
  }

  async render(page, parameters){
    // LOAD ALL PARTIALS IF THEY HAVEN'T BEEN
    if(!this.partials) this.partials = await this.load(partials);

    // LOAD JUST THE ONE PAGE THAT HAS BEEN REQUESTED
    if(!this.templates[page]){
      // EXTRACT JUST THE ONE ROUTE REQUESTED
      let _single_route = {};
      _single_route[page] = templates[page];
      // READ SAID FILE AND STORE THE ONE VALUE
      this.templates[page] = (await this.load(_single_route))[page];
    }

    // RENDER AND RETURN
    return mustache.render(
      this.templates[page],
      this.parameters(parameters),
      this.partials
    );
  }

  parameters(parameters = {}){
    let event = global.handler.event;
    return Object.assign({
      'base_url_path':
        // Turn "/login" into "/" and turn "/something/" into "/something/".
        event.requestContext.path.
          replace(/^(.*)\/\w$/, function (base_path) { base_path + "/"}),
      'assets_host':
        // Look for the ASSETS_HOST environment variable first.
        process.env.ASSETS_HOST ||
        // Fall back on looking at the same host, on port 8081.
        // For development mode.  (see: npm run assets, in README)
        ("//" + event.headers.Host + ":8081")
    },parameters);
  }

}

let _instance = new TemplateRenderer();

module.exports = _instance;