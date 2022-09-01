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
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

var spec = null;
var swaggerDoc = null;

const EXPRESSION = "expression";

//Wait between reports, 10s
const wait_number = 0;

//////////////////////////////////////////////////////
// Functions returns the expressionValue            //
// property from theintent request                  //  
//////////////////////////////////////////////////////
function getExpression(req) {
	var expression;
  if(req.body.expression.expressionValue!==undefined) {
  	expression=req.body.expression.expressionValue;
  }  
  return expression;
}

//////////////////////////////////////////////////////
// Functions returns the file name                  //
// to be used to create the intentReport            //  
//////////////////////////////////////////////////////
function intentReportFileName(expression) {
  var filename = '';
  if (expression.indexOf("B1")>0) { 
     filename = 'B1R_catalyst_business_intent_report.ttl'
  } else if (expression.indexOf("S1")>0) { 
    filename = 'S1R_catalyst_service_intent_report.ttl'
  } else if (expression.indexOf("R1")>0) { 
    filename = 'R1R_catalyst_resource_intent_report_slice.ttl'
  } else if (expression.indexOf("R2")>0) { 
    filename = 'R2R_catalyst_resource_intent_report_privateline.ttl'
  }
  return filename;
}

////////////////////////////////////////////////////////
// Deletes the intent without notification            //  
////////////////////////////////////////////////////////
function deleteIntent(id) {
  var query = {
    id: id
  };


  const resourceType = 'Intent';

  mongoUtils.connect().then(db => {
    db.collection(resourceType)
      .deleteOne(query)
      .then(doc => {
        if (doc.result.n == 1) {
          console.log("intent deleted " + id);

        } else {
          console.log("No resource with given id found");
        }
      }).catch(error => {
        console.log("retrieveIntent before delete: error=" + error);
      });
  })
    .catch(error => {
      console.log("retrieveIntent before delete: error=" + error);
    });
}

////////////////////////////////////////////////////////
// Functions reads mongo to extract intent expression //
// and then parse into triples and delete             //  
////////////////////////////////////////////////////////
function getIntentExpressionandDeleteKG(query,resourceType) {
  mongoUtils.connect().then(db => {
    db.collection(resourceType)
      .findOne(query)
      .then(doc => {
        if(doc) {
          console.log('doc: '+JSON.stringify(doc));
          //convert to triples and delete
          extractTriplesandKG(doc.expression.expressionValue,`delete`,'text/turtle');
          deleteIntent(doc.id);
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
// Deletes the intentreport without notification      //  
////////////////////////////////////////////////////////
function deleteIntentReport(id){
  var query = {
    id: id
  };


  const resourceType = 'IntentReport';

mongoUtils.connect().then(db => {
  db.collection(resourceType)
    .deleteOne(query)
    .then(doc => {
      if (doc.result.n == 1) {
         console.log("report deleted " + id);

      } else { 
        console.log("No resource with given id found");
      }
    }).catch(error => {
        console.log("retrieveIntent before delete: error=" + error);
      });
  })
  .catch(error => {
    console.log("retrieveIntent before delete: error=" + error);
  });
}

////////////////////////////////////////////////////////
// Functions reads mongo to extract intentreport expression //
// and then parse into triples and delete             //  
////////////////////////////////////////////////////////
function getIntentReportExpressionandDeleteKG(id,resourceType) {
  var intentId = {
    'intent.id':id
  }

  var query = {
    criteria:intentId
  }

    // Find some documents based on criteria plus attribute selection
    mongoUtils.connect()
    .then(db => {
      db.collection(resourceType).stats()
      .then(stats => {
        const totalSize=stats.count;
        db.collection(resourceType)
        .find(query.criteria, query.options).toArray()
        .then(doc => {

          doc.forEach(x => {
            console.log('id: '+x.id);
            //convert to triples and delete
            extractTriplesandKG(x.expression.expressionValue,`delete`,'text/turtle');
            deleteIntentReport(x.id);
          });
          })
        })
        .catch(error => {
          console.log("listIntentReport: error=" + error);
        })
      })
      .catch(error => {
        console.log("listIntentReport: error=" + error);
      })
    .catch(error => {
      console.log("listIntentReport: error=" + error);
    })

}


////////////////////////////////////////////////////////
// Functions receives an intent expression and parses  //
// into mongo using RDFLIB                             //
// Because expression is json-ld the parsing is done   //
// async                                               //
// Once parsing is done it will insert or delete,      //
// according to action parameter                       //  
////////////////////////////////////////////////////////
function extractTriplesandKG (expression,action,type) {
  var uri = 'http://www.example.org/IntentNamespace/';
  var mimeType = 'application/ld+json';
  if(type!==undefined) {
    mimeType = type;
  }

  var store = $rdf.graph();
  var triples;
//  console.log('extract Triples:: ' + expression);

 //create rdf object
 try {
   $rdf.parse(expression, store, uri, mimeType,function (){
    triples = store.statementsMatching(undefined, undefined, undefined);
    console.log('number of triples: '+triples.length);
    return kgOperation(triples,action);
//    return null;
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
    var q = action + ` data { graph <${GRAPHDB_CONTEXT_TEST}> { ` + triple.subject +` `+ triple.predicate +` `+ triple.object + ` }}`;
    q = q.replace(/_:/g,'ex:');
    console.log('query: '+q); 
    graphDBEndpoint
    .update( q)
    .then((result) => {
      console.log('OK');})
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
function insertIntentReport(name,report,req) {
  const resourceType = 'IntentReport';

  //generates message
  const message = createIntentReportMessage(name,report,req);
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
function createIntentReportMessage(name,data,req) {
  var intent_uuid = req.body.id;
  var intent_href 
  
  if (req.body.href!==undefined)
     intent_href=req.body.href;
  else 
     intent_href='http://'+req.headers.host+'/tmf-api/intent/v4/intent/'+intent_uuid;
  
    //expression
  var expression = {
    iri: "http://tio.models.tmforum.org/tio/v2.0.0/IntentCommonModel",
    "@baseType": "Expression",
    "@type": "TurtleExpression", 
    expressionLanguage: "Turtle",
    expressionValue: data,
    "@schemaLocation": "https://mycsp.com:8080/tmf-api/schema/Common/TurtleExpression.schema.json",
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
    name: name,
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

////////////////////////////////////////////////////////
// Function used to send intent reports               //
////////////////////////////////////////////////////////
function sendIntentReport(name,filename,req) {
  fs.readFile('./ontologies/'+filename, 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      return;
    }
 //   console.log(data);
  //2. insert report in grapbdb
  extractTriplesandKG(data,`insert`,'text/turtle');

 //3. insert report into mongodb and send notification
  insertIntentReport(name,data,req);
  //4. create event
//  inside the previous step as async

  wait(wait_number);
});
}

////////////////////////////////////////////////////////
// Function used to send intent reports               //
////////////////////////////////////////////////////////
function sendIntentReportandFindID(name,filename,req) {
  fs.readFile('./ontologies/'+filename, 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      return;
    }
 //   console.log(data);
  //2. insert report in grapbdb
  extractTriplesandKG(data,`insert`,'text/turtle');

 //3. find parentid
  var id = req.body.event.intentReport.intent.id
  var parentId;

 var query = mongoUtils.getMongoQuery(req);
 query.criteria.id = id

 query = swaggerUtils.updateQueryServiceType(query, req,'id');

 var resourceType = 'Intent'; 
 const internalError =  new TError(TErrorEnum.INTERNAL_SERVER_ERROR, "Internal database error");

 mongoUtils.connect().then(db => {
   db.collection(resourceType)
     .findOne(query.criteria, query.options)
     .then(doc => {
       if(doc) {
         parentId = doc.version;
         console.log('ID: '+id+ ' parentId: '+parentId);
         req.body.id = parentId;
//3. insert report into mongodb and send notification
         insertIntentReport(name,data,req);
       } else {
         sendError(res, new TError(TErrorEnum.RESOURCE_NOT_FOUND,"No resource with given id found"));
       }
     })
     .catch(error => {
       console.log("retrieveIntent: error=" + error);
       sendError(res, internalError);
     });
 })
 .catch(error => {
   console.log("retrieveIntent: error=" + error);
   sendError(res, internalError);
 });

 //4. create event
//  inside the previous step as async

  wait(wait_number);
});
}

////////////////////////////////////////////////////////
// Function used to send intent reports               //
////////////////////////////////////////////////////////
function sendIntentReportandFindR1(name,filename,req) {
  fs.readFile('./ontologies/'+filename, 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      return;
    }
 //   console.log(data);
  //2. insert report in grapbdb
  extractTriplesandKG(data,`insert`,'text/turtle');

 //3. find parentid
  var parentId;

 var query = mongoUtils.getMongoQuery(req);
 query.criteria.name = 'R1_catalyst_resource_intent_slice'

 query = swaggerUtils.updateQueryServiceType(query, req,'name');

 var resourceType = 'Intent'; 
 const internalError =  new TError(TErrorEnum.INTERNAL_SERVER_ERROR, "Internal database error");

 mongoUtils.connect().then(db => {
   db.collection(resourceType)
   .find(query.criteria, query.options).toArray()
   .then(doc => {

     doc.forEach(x => {
       req.body.id = x.id;
//3. insert report into mongodb and send notification
         insertIntentReport(name,data,req);
         return
     })

     })
     .catch(error => {
       console.log("retrieveIntent: error=" + error);
       sendError(res, internalError);
     });
 })
 .catch(error => {
   console.log("retrieveIntent: error=" + error);
   sendError(res, internalError);
 });

 //4. create event
//  inside the previous step as async

  wait(wait_number);
});
}

function wait(ms){
  var start = new Date().getTime();
  var end = start;
  while(end < start + ms) {
    end = new Date().getTime();
 }
}

////////////////////////////////////////////////////////
// Generates intent report message                    //
////////////////////////////////////////////////////////
function createIntentMessage(name,data) {
  
  var date = new Date();
  var date_start = date.toISOString();
  var date_end = (new Date(date.getFullYear()+1, date.getMonth(), date.getDate())).toISOString();

  //expression
  var expression = {
    iri: "http://tio.models.tmforum.org/tio/v2.0.0/IntentCommonModel",
    "@baseType": "Expression",
    "@type": "TurtleExpression", 
    expressionLanguage: "Turtle",
    expressionValue: data,
    "@schemaLocation": "https://mycsp.com:8080/tmf-api/schema/Common/TurtleExpression.schema.json",
  };

  var message = {
    creationDate: date_start,
    expression: expression,
    name: name,
    description: name,
    '@schemaLocation': "https://mycsp.com:8080/tmf-api/schema/Common/TurtleExpression.schema.json",
    lifecycleStatus: "Created",
    '@baseType': "Intent",
    validFor: {
      startDateTime: date_start,
      endDateTime: date_end
    },
    '@type': "Intent",
    'version': "1"
    };  

  return message;

};

////////////////////////////////////////////////////////
// POST a new Intent to the next layer               //
////////////////////////////////////////////////////////
function postIntent(name,filename,req) {
  fs.readFile('./ontologies/'+filename, 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      return;
    }

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
       if (this.readyState == 4 && this.status == 200) {
           //do nothing for now
           null;
           //alert(this.responseText);
       }
    };
    var url = 'http://'+req.headers.host+req.originalUrl;
    console.log('URL: '+url);
    xhttp.open("POST", url, true);
    xhttp.setRequestHeader("Content-Type", "application/json");
    xhttp.setRequestHeader("accept", "application/json");
    
    var payload = createIntentMessage(name,data);
    payload.version=req.body.id;
    payload = JSON.stringify(payload);
    
    xhttp.send(payload);

  });
};

function checkandSendReport(payload,req) {
  var filename;
 //Provisioning flow
  //S1R1 -> B1R2
  if (payload.indexOf("S1R1")>0){ // check whether it's a resource intent
     filename = 'B1R2_Intent_Degraded.ttl'
     sendIntentReportandFindID('B1R2_Intent_Degraded',filename,req);;
     console.log('log: B1 Report Degraded 1 sent');
  }
  //S1R2 -> B1R3
  else if (payload.indexOf("S1R2")>0){ // check whether it's a resource intent
    filename = 'B1R3_Intent_Degraded.ttl'
    sendIntentReportandFindID('B1R3_Intent_Degraded',filename,req);
    console.log('log: B1 Report Degraded 2 sent');
  }
     
  //R1R2 -> S1R3 
  else if (payload.indexOf("R1R2")>0){ // check whether it's a resource intent
    filename = 'S1R3_Intent_Compliant.ttl'
    sendIntentReportandFindID('S1R3_Intent_Compliant',filename,req);
    console.log('log: S1 Report Compliant sent');
  }

    //S1R3 -> B1R4
  else if (payload.indexOf("S1R3")>0){ // check whether it's a resource intent
      filename = 'B1R4_Intent_Compliant.ttl'
      sendIntentReportandFindID('B1R4_Intent_Compliant',filename,req);
      console.log('log: B1 Report Compliant sent');
  }

//Degradation floww
 
  //incident -> R1R3
  else if (payload.indexOf("incident")>0){ // check whether it's a resource intent
    filename = 'R1R3_Intent_Issue.ttl'
    sendIntentReportandFindR1('R1R3_Intent_Issue',filename,req);
    console.log('log: R1 Report Issue sent');
  }
  
  //R1R3 -> S1R4
  else if (payload.indexOf("R1R3")>0){ // check whether it's a resource intent
      filename = 'S1R4_Intent_Issue.ttl'
      sendIntentReportandFindID('S1R4_Intent_Issue',filename,req);
      console.log('log: S1 Report Issue sent');
  }

  //S1R4 -> B1R5
  else if (payload.indexOf("S1R4")>0){ // check whether it's a resource intent
    filename = 'B1R5_Intent_Issue.ttl'
    sendIntentReportandFindID('B1R5_Intent_Issue',filename,req);
    console.log('log: B1 Report Issue sent');
  }


 
}

module.exports = { 
  getExpression,
  getIntentExpressionandDeleteKG,
  getIntentReportExpressionandDeleteKG,
  kgOperation,
  extractTriplesandKG,
  insertIntentReport,
  createIntentReportMessage,
  createIntentReportReq,
  intentReportFileName,
  sendIntentReport,
  postIntent,
  createIntentMessage,
  checkandSendReport
				   			 };
