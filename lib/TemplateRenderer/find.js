// const route = require('./route');
const readdir   = require('fs').readdir;
const route     = require('./route');
const isPartial = require('./is-partial');

const mapName = function(filename){
  let name = filename.replace(/^\_/,'').replace(/\.mustache$/,'');
  let obj = {};
  obj[name] = route("templates/"+filename);
  return obj;
}

module.exports = function() {
  return new Promise((resolve,reject)=>{
    readdir(route("templates"),(err,files)=>{
      console.log("TemplateRenderer.find err files",err,files);
      if(err){ reject(err)}
      else{
        let partials  = {} , templates = {} ;
        files
          .filter(name => /\.mustache$/.test(name))
          .map( mapName )
          .forEach( route =>{
            if( isPartial(route) ) Object.assign(partials,route)
            else Object.assign(templates,route)
          });
        resolve({partials,templates});
      }
    })
  });
};