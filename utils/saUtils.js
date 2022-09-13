////////////////////////////////////////////////////////
/*              Ericsson IRC                          */
/*              Idan Catalyst                         */
/* SAUtils:                                           */
/* Functions to monitor issues reported by SA         */
////////////////////////////////////////////////////////

'use strict';

var fs = require('fs'),
  path = require('path'),
  jsyaml = require('js-yaml');

const { TError, TErrorEnum, sendError } = require('./errorUtils');
const swaggerUtils = require('./swaggerUtils');
const mongoUtils = require('./mongoUtils');
const intentService = require('../service/IntentService');
const $rdf = require('rdflib');
const uuid = require('uuid');
const notificationUtils = require('./notificationUtils');
const handlerUtils = require('./handlerUtils');

var spec = null;
var swaggerDoc = null;
var graphDBEndpoint = null;
var graphDBContext = null;

function initGraphdbEndpointAndContext() {
  if ((graphDBEndpoint == null) || (graphDBContext == null)){
    var kgConfig;
    try {
      kgConfig = require('../kgconfig.json');
    } catch (e) {
      console.log(e)
    }

    const { EnapsoGraphDBClient } = require('@innotrade/enapso-graphdb-client');
    // connection data to the GraphDB instance
    const GRAPHDB_BASE_URL = kgConfig.GRAPHDB_BASE_URL,
      GRAPHDB_ISSUE_REPOSITORY = kgConfig.GRAPHDB_ISSUE_REPOSITORY,
      GRAPHDB_USERNAME = kgConfig.GRAPHDB_USERNAME,
      GRAPHDB_PASSWORD = kgConfig.GRAPHDB_PASSWORD,
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
      {
        prefix: "cem",
        iri: "http://tio.labs.tmforum.org/tio/v1.0.0/CatalystExtensionModel#"
      }
    ];

    graphDBContext = GRAPHDB_CONTEXT_TEST;

    graphDBEndpoint = new EnapsoGraphDBClient.Endpoint({
      baseURL: GRAPHDB_BASE_URL,
      repository: GRAPHDB_ISSUE_REPOSITORY,
      prefixes: DEFAULT_PREFIXES
    });

    // connect and authenticate
    graphDBEndpoint.login(GRAPHDB_USERNAME, GRAPHDB_PASSWORD)
      .then((result) => {
        console.log(result);
      })
      .catch((err) => {
        console.log(err);
        return;
      });
  }
}

/////////////////////////////////////////////
// Function monitors the issues that       //
// are reported by SA and put in graphDB   //  
/////////////////////////////////////////////
async function monitorIssuesGraphDb() {

  initGraphdbEndpointAndContext();

  // get list of all issueIDs
  var query = `select * from <${graphDBContext}> where {
    ?issueId rdf:type cem:issue .
  }`;
  //console.log('QUERY1 = ' + query);

  graphDBEndpoint
    .query(query, { transform: 'toJSON' })
    .then((result) => {
      //console.log('QUERY1 OK');
      console.log('RESULT = ' + JSON.stringify(result))

      let promises = [];
      if ((result.success) && (result.total > 0)) {
        for (var i = 0; i < result.total; i++) {
          var issueId = result.records[i].issueId;
          promises.push(resolveIssue(issueId, graphDBEndpoint, graphDBContext));
        }

        // wait until all the issues have been resolved
        Promise.all(promises)
          .then(() => {
            // delete all triples of the resolved issues
            var filterExprForDelete = createFilterExprForAllIssues(result.records);
            query = `select * from <${graphDBContext}> where {
                  ?s rdf:type cem:issue .
                  ?s ?p ?o .
                  filter(${filterExprForDelete})
                }`;
            //console.log('QUERY3 = ' + query);

            graphDBEndpoint
              .query(query, { transform: 'toJSON' })
              .then((result) => {
                //console.log('QUERY3 OK');
                //console.log('RESULT = ' + JSON.stringify(result))

                if (result.success) {
                  for (var j = 0; j < result.total; j++) {
                    query = `delete data {graph <${graphDBContext}> { <${result.records[j].s}> <${result.records[j].p}> <${result.records[j].o}> }}`;
                    //console.log('QUERY4 = ' + query);

                    graphDBEndpoint
                      .update(query)
                      .then((result) => {
                        //console.log('QUERY4 OK');
                        //console.log('RESULT = ' + JSON.stringify(result))
                      })
                      .catch((err) => {
                        console.log("failed to delete from graphDB " + err.message);
                      });
                  }
                }
              })
              .catch((err) => {
                console.log("failed to read graphDB " + err.message);
              });
          })
          .catch((err) => {
            console.log("failed to read graphDB " + err.message);
          });
      }
    })
    .catch((err) => {
      console.log("failed to read graphDB " + err.message);
    });

}

function resolveIssue(issueId, graphDBEndpoint, graphDBContext) {
  // 2. The send the S1 intent
  //just needed to test without symphonica
//  var filename = 'R1_PATCH_catalyst_resource_intent_slice.ttl'
//  handlerUtils.patchIntent('R1_PATCH_catalyst_resource_intent_slice',filename);
//  console.log('log: R1 Patch Intent POSTed');
  
  return new Promise(function (resolve, reject) {
    const serviceIdIri = "http://www.example.org/IntentNamespace#";

    // get serviceID of the issue
    var query = `select * from <${graphDBContext}> where {
      <${issueId}> cem:monitored_object ?sid .
    }`;
    //console.log('QUERY2 = ' + query);

    graphDBEndpoint
      .query(query, { transform: 'toJSON' })
      .then((result) => {
        //console.log('QUERY2 OK');
        //console.log('RESULT = ' + JSON.stringify(result))

        if ((result.success) && (result.total > 0)) {
          var serviceId = result.records[0].sid.split(serviceIdIri)[1];

          sendHealServiceOrder(serviceId);

          resolve();
        }
      })
      .catch((err) => {
        console.log("failed to read graphDB " + err.message);
        reject(err);
      });
  });
}

/////////////////////////////////////////////
// Function returns a string in the format //
// of: ?s = ex:issue1 || ?s = ex:issue2    //  
/////////////////////////////////////////////
function createFilterExprForAllIssues(issueArray) {
  var filterExpr = '';
  for (var i = 0; i < issueArray.length; i++) {
    filterExpr += `?s = <${issueArray[i].issueId}>`
    if (i != (issueArray.length - 1)) {
      filterExpr += ' || ';
    }
  }
  return filterExpr;
}

function sendHealServiceOrder(serviceId) {
  const soUtils = require('../utils/soUtils');
  fs.readFile('./serviceorders/service_order_connectivity_ptp_HEAL.json', 'utf8', (err, healOrder) => {

    if (err) {
      console.error('unable to read heal service order json file due to error:', err);
      return;
    }

    var healOrderJson = JSON.parse(healOrder);
    healOrderJson.orderItems[0].service.characteristics[0].value = "2";
    healOrderJson.orderItems[0].service.characteristics[1].value = "100";
    healOrderJson.orderItems[0].service.publicIdentifier = serviceId;
    healOrderJson.orderItems[0].service.serviceRelationship[0].service.publicIdentifier = serviceId;
    console.log("SERVICE ORDER = " + JSON.stringify(healOrderJson));

    try {
      soUtils.sendServiceOrder(JSON.stringify(healOrderJson));
    }
    catch (error) {
      console.error('saUtils: sendHealServiceOrder failed with error:', error);
      return;
    }
  });
}

module.exports = {
  monitorIssuesGraphDb
};
