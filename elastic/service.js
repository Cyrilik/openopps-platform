const elasticClient = require('./index');
const log = require('log')('elastic:service');
const dao = require('./dao');
const _ = require('lodash');
const fs = require('fs');

var service = {};

service.reindexOpportunities = async function () {
  var records = await dao.tasksToIndex();
  var bulk_request = [];
  
  for(i=0; i<records.length; i++){
    bulk_request.push({index: { _index: 'task', _type: 'task', _id: records[i].id }});
    bulk_request.push(records[i]);
  }
  
  await elasticClient.bulk({ body: bulk_request });
  return records;
};

service.remapOpportunities = async function () {
  if (await elasticClient.indices.exists({ index: 'task'})) {
    await elasticClient.indices.putMapping({
      index: 'task',
      type: 'task',
      body: JSON.parse(fs.readFileSync('./elastic/task_mapping.json')).task,
    }).catch(async err => {
      log.error('Error updating mapping. %o', err);
      await elasticClient.indices.delete({ index: 'task' });
    });
  }

  return service.reindexOpportunities();
};

service.reindexUsers = async function () {
  var records = await dao.usersToIndex();
  var bulk_request = [];
  
  for(i=0; i<records.length; i++){
    bulk_request.push({index: { _index: 'user', _type: 'user', _id: records[i].id }});
    bulk_request.push(records[i]);
  }
  
  await elasticClient.bulk({ body: bulk_request });
  return records;
};

service.remapUsers = async function () {
  if (await elasticClient.indices.exists({ index: 'user'})) {
    await elasticClient.indices.putMapping({
      index: 'user',
      type: 'user',
      body: JSON.parse(fs.readFileSync('./elastic/user_mapping.json')).user,
    });
  }

  return service.reindexUsers();
};

service.reindexCycleOpportunities = async function (cycleId) {
  var records = await dao.cycleTasksToIndex(cycleId);
  if (records.length) {
    var bulk_request = [];
    
    for(i=0; i<records.length; i++){
      bulk_request.push({index: { _index: 'task', _type: 'task', _id: records[i].id }});
      bulk_request.push(records[i]);
    }
    
    await elasticClient.bulk({ body: bulk_request });
  }
  return records;
};

service.reindexAgencyOpportunities = async function (agencyId) {
  var records = await dao.agencyTasksToIndex(agencyId);
  if (records.length) {
    var bulk_request = [];
    
    for(i=0; i<records.length; i++){
      bulk_request.push({index: { _index: 'task', _type: 'task', _id: records[i].id }});
      bulk_request.push(records[i]);
    }
    
    await elasticClient.bulk({ body: bulk_request });
  }
  return records;
};

service.reindexCommunityOpportunities = async function (communityId) {
  var records = await dao.communityTasksToIndex(communityId);
  if (records.length) {
    var bulk_request = [];
    
    for(i=0; i<records.length; i++){
      bulk_request.push({index: { _index: 'task', _type: 'task', _id: records[i].id }});
      bulk_request.push(records[i]);
    }
    
    await elasticClient.bulk({ body: bulk_request });
  }
  return records;
};

service.deleteCommunityOpportunities = async function (communityId) {
  var records = await dao.communityTasksToIndex(communityId);
  if (records.length) {
    var bulk_request = [];
    
    for(i=0; i<records.length; i++){
      bulk_request.push({ delete: { _index: 'task', _type: 'task', _id: records[i].id }});
    }
    
    await elasticClient.bulk({ body: bulk_request });
  }
  return records;
};

service.indexOpportunity =  async function (taskId) {
  if (!(await elasticClient.IsAlive()))
  {
    return null;
  }
  var records = await dao.taskToIndex(taskId);
  
  var bulk_request = [];
  
  for(i=0; i<records.length; i++){
    bulk_request.push({index: { _index: 'task', _type: 'task', _id: records[i].id }});
    bulk_request.push(records[i]);
  }
  
  await elasticClient.bulk({ body: bulk_request });
  return records;
};

service.deleteOpportunity = async function (taskId) {
  if (!(await elasticClient.IsAlive())) {
    return null;
  }

  await elasticClient.bulk({ body: [{ delete: { _index: 'task', _type: 'task', _id: taskId } }] });
  return true;
};

service.indexUser =  async function (userId) {
  if (!(await elasticClient.IsAlive()))
  {
    return null;
  }
  var records = await dao.userToIndex(userId);
  
  var bulk_request = [];
  
  for(i=0; i<records.length; i++){
    bulk_request.push({index: { _index: 'user', _type: 'user', _id: records[i].id }});
    bulk_request.push(records[i]);
  }
  
  await elasticClient.bulk({ body: bulk_request });
  return records;
};

service.deleteUser = async function (userId) {
  if (!(await elasticClient.IsAlive())) {
    return null;
  }

  await elasticClient.bulk({ body: [{ delete: { _index: 'user', _type: 'user', _id: userId } }] });
  return true;
};

service.searchOpportunities = async function (request) {
  var searchResults = null;
  if(request){
    searchResults = await elasticClient.search(request);
  }
  else{
    searchResults = await elasticClient.search({ index: 'task' });
  }
  
  var result = {};
  result.totalHits = searchResults.hits.total;
  result.hits = _.map(searchResults.hits.hits, convertSearchResultsToResultModel);
  return result;
};

service.searchUsers = async function (request) {
  var searchResults = await elasticClient.search(request || { index: 'user' });
  return {
    totalHits: searchResults.hits.total,
    hits: _.map(searchResults.hits.hits, (hit) => {
      return {
        score: hit._score,
        result: hit._source,
      };
    }),
  };
};
  
service.convertQueryStringToOpportunitiesSearchRequest = function (ctx, index){
  var query = ctx.query;
  var page = query.page || 1;
  var resultsperpage =  query.resultsperpage || 20;
  var from = (page - 1) * resultsperpage;
  
  var request = {
    index: index || 'task',
    type: 'task',
    from: from > 0 ? from : 0,
    size: resultsperpage > 0 ? resultsperpage : 20,
    body: {
      sort:[{'publishedAt':'desc'}],
      query : {
        bool : {
          filter : {
            bool: {
              must: [] ,
              must_not: [],
            },
          },
          should : [],
          minimum_should_match : query.isInternship == '1' && query.location ? 1 : 0,
        },
      },
    },
    addTerms (filter, field, defaultFilter) { 
      filter = filter || defaultFilter;
      if((filter && filter !== '_all')){
        filter = [].concat(filter).map(value => { 
          return _.isString(value) ? value.split('|')[0] : value;
        }); // remove ids
        filter_must.push({terms: { [field] : asArray(filter) }});
      }
    },
    addCycleDate () {
      filter_must.push({range: { 'cycle.applyEndDate' : { gte: new Date() } }});
      filter_must.push({range: { 'cycle.applyStartDate' : { lte: new Date() } }});
    },
    addLocations (location) { 
      should_match.push({ multi_match: { 
        fields: ['postingLocation.cityName', 'postingLocation.countrySubdivision', 'postingLocation.country', 'postingLocation.cityCountrySubdivision', 'postingLocation.cityCountry'],
        query: location.split('|')[0], // remove ids,
      }});
    },
  };
  switch (query.sort) {
    case 'relevance':
    case undefined:
      request.body.sort.unshift('_score');
      break;
    case 'title':
      request.body.sort.unshift('title.keyword');
      break;
    case 'agency':
      request.body.sort.unshift('agency.name');
      break;  
    case 'posted-date':
      // already the base sort for Elastic
      break;
    case 'posted-by':
      request.body.sort.unshift('ownerName');
      break;
    case 'status':
      request.body.sort.unshift('state');
      break;
    case 'location': 
      request.body.sort.unshift('locations.name');
      break;
    default:
      request.body.sort.unshift(query.sort);
      break;
  }

  var filter_must = request.body.query.bool.filter.bool.must;
  var filter_must_not = request.body.query.bool.filter.bool.must_not;
  var should_match = request.body.query.bool.should;
  
  var formatParamTypes = ['community', 'skill', 'career', 'series', 'location', 'keywords', 'language', 'agency'];

  var seriesList = [];
  if (query.series && _.isArray(query.series)) {
    _.each(query.series, function (item) {
      seriesList.push(item.split('(')[0].trim());
    });
    query.series = seriesList;
  } else if (query.series) {
    query.series = query.series.split('(')[0].trim();
  }
  
  var agencies = ['null'];
  
  if (ctx.state.user && ctx.state.user.agency) {
    if (query.restrict) {
      agencies = [].concat(query.restrict);
    } else {
      if (ctx.state.user.isAdmin) {
        agencies = [];
      } else {
        ctx.state.user.agencies.map(agency => {
          agencies.push(agency.agency_id);
        });
      }
    }
  } else if (query.community) {
    agencies = [];
  }
  if (agencies.length > 0) {
    request.addTerms(agencies, 'restrictedToAgency');
  }

    

  var keywords = [];
  if (query.term) {
    keywords = Array.isArray(query.term) ? query.term : [query.term];
  }
  if (query.keywords) {
    if (Array.isArray(query.keywords)) {
      keywords = _.union(keywords, query.keywords);
    }
    else {
      keywords.push(query.keywords);
    }
  }
  if (keywords.length > 0) {
    var keyword = '';
    keyword = keywords.join(' ');
    request.body.query.bool.must = {
      simple_query_string: {
        query : keyword,
      },
    };
  }

  if (!isNaN(query.isInternship) && query.isInternship == 1) {
    filter_must_not.push({terms: { ['state'] : ['submitted', 'draft'] }});
    request.addTerms(query.program, 'community.id');
    request.addTerms(query.agency, 'postingAgency');
    request.addTerms(query.bureau, 'bureau.id');
    request.addTerms(query.office, 'office.id');
    request.addCycleDate();
    if (query.location) {
      if (_.isArray(query.location)) {
        _.each(query.location, function (location) {
          request.addLocations(location);
        });
      } else {
        request.addLocations(query.location);
      }
    }
  } else {
    request.addTerms(query.state, 'state', 'open');
    if(query.locationType) { 
      query.location = asArray(query.location || []).concat(query.locationType);
    }
    request.addTerms(query.location, 'locations.name');
    request.addTerms(query.agency, 'agency.name');
    request.addTerms(query.department, 'department.name');
  }
  request.addTerms(query.community, 'community.id');
  request.addTerms(query.isInternship, 'isInternship');
  request.addTerms(query.skill, 'skills.name');
  request.addTerms(query.career, 'careers.id');
  request.addTerms(query.series, 'series.code');
  request.addTerms(query.time, 'timeRequired');
  request.addTerms(query.language, 'languages.name');
  request.addTerms(query.payPlan, 'payPlan.id');
  request.addTerms(query.detailSelection, 'detailSelection');
  request.addTerms(query.grade, 'grade');
  
  delete request.addTerms;
  delete request.addLocations;
  delete request.addCycleDate;

  return request;
};

function convertSearchResultsToResultModel (searchResult) {
  var model = {};
  var source = searchResult._source;
  model.score = searchResult._score;
  model.result = {
    id: source.id,
    title: source.title,
    status: source.state,
    description: source.description,
    details: source.details,
    outcome: source.outcome,
    about: source.about,
    grade: source.grade,
    agencyId:source.agencyId,
    agencyName: source.agencyName,
    restrictedToAgency: source.restrictedToAgency,
    requester: source.requester,
    publishedAt: source.publishedAt,
    postingAgency: source.postingAgency,
    acceptingApplicants: source.acceptingApplicants,
    taskPeople: source.taskPeople,
    timeRequired: source.timeRequired,
    timeEstimate: source.timeEstimate,
    taskLength: source.taskLength,
    skills: source.skills,
    locationType: source.locationType,
    locations: source.locations,
    postingLocation: source.postingLocation,
    series: source.series,
    careers: source.careers,
    keywords: source.keywords,
    owner: source.owner,
    community: source.community,
    detailSelection: source.detailSelection,
    bureau: source.bureau,
    office: source.office,
    payPlan:source.payPlan,
    agency : source.agency,
    ownerName:source.ownerName,
  };
  removeEmpty(model);
  return model;
}

function asArray (value) {
  return Array.isArray(value) ? value: [value];
}

const removeEmpty = (obj) => {
  Object.keys(obj).forEach(key => {
    if (Array.isArray(obj[key]) && obj[key].length === 0) delete obj[key];
    if (obj[key] && typeof obj[key] === 'object') removeEmpty(obj[key]);
    else if (obj[key] == null) delete obj[key];
  });
};
  
module.exports = service;
