//////////////////////////////////////////////////////
/*              Huawei IRC                          */
/*              Idan Catalyst                       */
/* HandlerUtils:                                    */
/* Functions to support the intent handler          */
//////////////////////////////////////////////////////

'use strict';

var fs = require('fs'),
    path = require('path'),
    jsyaml = require('js-yaml');

const {TError, TErrorEnum, sendError} = require('./errorUtils');
const swaggerUtils = require('./swaggerUtils');
const mongoUtils = require('./mongoUtils');
const intentService = require('../service/IntentService');
const $rdf = require('rdflib');
const uuid = require('uuid');
const notificationUtils = require('../utils/notificationUtils');

var spec = null;
var swaggerDoc = null;

const EXPRESSION = "expression";

//////////////////////////////////////////////////////
// Functions returns the expressionLanguage         //
// property from theintent request                  //  
//////////////////////////////////////////////////////
function getExpression(req) {
	var expression;
  if(req.body.expression.expressionLanguage!==undefined) {
  	expression=req.body.expression.expressionLanguage;
  }  
  return expression;
}

////////////////////////////////////////////////////////
// Functions reads mongo to extract intent expression //
// and then parse into triples and delete             //  
////////////////////////////////////////////////////////
function getIntentExpressionandDeleteKG(query,resourceType) {
  mongoUtils.connect().then(db => {
    db.collection(resourceType)
      .findOne(query.criteria, query.options)
      .then(doc => {
        if(doc) {
          console.log('doc: '+JSON.stringify(doc));
          //convert to triples and delete
          extractTriplesandKG(doc.expression.expressionLanguage,`delete`);
        } else {
          console.log("No resource with given id found");
        }
      })
      .catch(error => {
        console.log("retrieveIntent before delete: error=" + error);
      });
  })
  .catch(error => {
    console.log("retrieveIntent before delete: error=" + error);
  });
}

////////////////////////////////////////////////////////
// Functions receives an intent expression and parses  //
// into mongo using RDFLIB                             //
// Because expression is json-ld the parsing is done   //
// async                                               //
// Once parsing is done it will insert or delete,      //
// according to action parameter                       //  
////////////////////////////////////////////////////////
function extractTriplesandKG (expression,action) {
  var uri = 'http://www.example.org/IntentNamespace/';
  var mimeType = 'application/ld+json';
  //var mimeType = 'text/turtle';
  var store = $rdf.graph();
  var triples;
//  console.log('extract Triples:: ' + expression);

 //create rdf object
 try {
   $rdf.parse(expression, store, uri, mimeType,function (){
    triples = store.statementsMatching(undefined, undefined, undefined);
    console.log('number of triples: '+triples.length);
    return kgOperation(triples,action);
  })
 } catch (err) {
   console.log(err);
 };


};

////////////////////////////////////////////////////////
// Functions receives triples array and insert/deletes //
// into KG                                            //
// Uses innotrade/enapso-graphdb-client               // 
// https://www.npmjs.com/package/@innotrade/enapso-graphdb-client //
////////////////////////////////////////////////////////
function kgOperation(triples,action) {
// Conf file for KG
  var conf;
  try {
      conf = require('../kgconfig.json');
      console.log("Loaded kgconfig");
  } catch (e) {
      console.log(e)
  }

  //  Now load into GraphDB
  const { EnapsoGraphDBClient } = require('@innotrade/enapso-graphdb-client');
  // connection data to the run GraphDB instance
    const GRAPHDB_BASE_URL = conf.GRAPHDB_BASE_URL,
          GRAPHDB_REPOSITORY = conf.GRAPHDB_REPOSITORY,
          GRAPHDB_USERNAME = conf.GRAPHDB_USERNAME,
          GRAPHDB_PASSWORD = conf.GRAPHDB_PASSWORD,
          GRAPHDB_CONTEXT_TEST = "http://www.example.org/IntentNamespace#",
          GRAPHDB_CONTEXT_SHACL = 'http://rdf4j.org/schema/rdf4j#SHACLShapeGraph';
  const DEFAULT_PREFIXES = [
    EnapsoGraphDBClient.PREFIX_OWL,
    EnapsoGraphDBClient.PREFIX_RDF,
    EnapsoGraphDBClient.PREFIX_RDFS,
    EnapsoGraphDBClient.PREFIX_XSD,
    EnapsoGraphDBClient.PREFIX_PROTONS,
    {
        prefix: "ex",
        iri: "http://www.example.org/IntentNamespace#",
    },
    {   prefix: "icm",
        iri: "http://tio.models.tmforum.org/tio/v1.0.0/IntentCommonModel#"
    },
    {   prefix: "imo",
      iri: "http://tio.models.tmforum.org/tio/v1.0.0/IntentManagementOntology#"
    }
  ];


  console.log('initialized KG');
  let graphDBEndpoint = new EnapsoGraphDBClient.Endpoint({
    baseURL: GRAPHDB_BASE_URL,
    repository: GRAPHDB_REPOSITORY,
    prefixes: DEFAULT_PREFIXES
  });
  console.log('end point KG obtained');

  // connect and authenticate
  graphDBEndpoint.login(GRAPHDB_USERNAME,GRAPHDB_PASSWORD)
  .then((result) => {
    console.log(result);
  })
  .catch((err) => {
    console.log(err);
  });

  const intent_iri = '<http://tio.models.tmforum.org/tio/v1.0.0/IntentCommonModel#Intent>';
  const intentreport_iri = '<http://tio.models.tmforum.org/tio/v1.0.0/IntentCommonModel#IntentReport>';


  for (var i=0; i<triples.length;i++) {
    var triple = triples [i];
    var q = action + ` data { graph <${GRAPHDB_CONTEXT_TEST}> { <` + triple.subject.value +`> <`+ triple.predicate.value +`> <`+ triple.object.value + `> }}`;

//    console.log('query: '+q);    
    graphDBEndpoint
    .update( q)
    .then((result) => {
        console.log(action + " a class :\n" + JSON.stringify(result, null, 2));})
    .catch((err) => {
      console.log("failed "+ action + " " + err.message);});
  }

}

////////////////////////////////////////////////////////
// Uses the intent report expression that was read from hardcoded file  //
// creates full intent report message                 //
// stores the intent report into mongo                //
// generates event (notify)                           //
////////////////////////////////////////////////////////
function insertIntentReport(report,req) {
  const resourceType = 'IntentReport';

  //generates message
  const message = createIntentReportMessage(report,req);
  //generates request for the notification
  const req1 = createIntentReportReq(req,resourceType);

  mongoUtils.connect().then(db => {
  db.collection(resourceType)
    .insertOne(message)
    .then(() => {

      console.log("createReport: loaded into Mongo");
      cleanmessageid(message);
      //generates the intentreport creation event
      notificationUtils.publish(req1,message);
    })
    .catch((error) => {
      console.log("createReport: error=" + error);
    })
})
.catch((error) => {
  console.log("createReport: error=" + error);
})

}

////////////////////////////////////////////////////////
// Generates intent report message                    //
////////////////////////////////////////////////////////
function createIntentReportMessage(data,req) {
  var intent_uuid = req.body.id;
  var intent_href=req.body.href;
    //expression
  var expression = {
    expressionLanguage: data,
    iri: "iri string",
    "@baseType": "@baseType string",
    "@schemaLocation": "@schemaLocation string",
    "@type": "@type string" 
  };

  //intent
  var intent = {
    href: intent_href,
    id: intent_uuid 
  };

  var id = uuid.v4();
  var message = {
    id: id,
    href: intent_href+'/intentReport/'+id,
    creationDate: (new Date()).toISOString(),
    expression: expression,
    intent: intent
  };
  return message;

}

////////////////////////////////////////////////////////
// Generates intent report request, to be used for the //
// notification event                                  //
////////////////////////////////////////////////////////
function createIntentReportReq(req,resourceType) {
  var operationPath = {
    0: 'paths',
    1: '/intent/{intentId}/intentReport',
    2: 'post'
  }
  var swagger1 = {
    operationPath: operationPath
  };

  var req1 = {
    method: 'POST',
    resourceType: resourceType,
    swagger: swagger1,
    url: req.url,
    name: 'Intent Report ABC'
  };
  return req1;
}

////////////////////////////////////////////////////////
// Removes _id from  message                          //
////////////////////////////////////////////////////////
function cleanmessageid(message) {
  delete message._id;
  return message
}

module.exports = { 
  getExpression,
  getIntentExpressionandDeleteKG,
  kgOperation,
  extractTriplesandKG,
  insertIntentReport,
  createIntentReportMessage,
  createIntentReportReq
				   			 };
