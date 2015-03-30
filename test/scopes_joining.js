'use strict';

var expect = require('chai').expect;
var Promise = require('bluebird');

var knex = require('knex')({
  client: 'sqlite3',
  connection: { filename: "./mytestdb" }
});

var bookshelf = require('bookshelf')(knex);
bookshelf.plugin(require('../src/scopes'));

describe('scopes - joining scope', function() {

  beforeEach(function() {
    return Promise.all([
      bookshelf.knex.schema.hasTable('testmodel').then(function(exists){
        if (exists) {
          return bookshelf.knex.schema.dropTable('testmodel');
        }
      }).then(function() {
        return bookshelf.knex.schema.createTable('testmodel', function (table) {
          table.increments();
          table.string('name');
          table.integer('status_id');
          table.integer('past_status_id');
          table.timestamps();
        });
      }),
      bookshelf.knex.schema.hasTable('teststatus').then(function(exists){
        if (exists) {
          return bookshelf.knex.schema.dropTable('teststatus');
        }
      }).then(function() {
        return bookshelf.knex.schema.createTable('teststatus', function (table) {
          table.increments();
          table.string('name');
        });
      })
    ]);
  });

  it('can add scope with a basic joining where and fetchAll from db', function() {

    var TestModel1 = bookshelf.Model.extend({
      tableName: 'testmodel',
      scopes: {
        active: function(qb) {
          qb.innerJoin('teststatus', 'testmodel.status_id', 'teststatus.id').
          where({'teststatus.name': 'Active'});
        }
      }
    });

    var TestStatus = bookshelf.Model.extend({
      tableName: 'teststatus',
    });

    expect(TestModel1.active).to.not.be.undefined;

    return Promise.all([
      TestModel1.forge({name: 'test', status_id: 1}).save(),
      TestModel1.forge({name: 'test2', status_id: 2}).save(),
      TestStatus.forge({name: 'Active'}).save(),
      TestStatus.forge({name: 'NotActive'}).save(),
    ]).then(function() {
      return TestModel1.active().fetchAll().then(function(allActive) {
        expect(allActive.length).to.equal(1);
        expect(allActive.models[0].get('status_id')).to.equal(1);
        expect(allActive.models[0].get('name')).to.equal('test');

      });
    });
  });

  it('can add scope with an alies joining where and fetchAll from db', function() {
    var TestModel1 = bookshelf.Model.extend({
      tableName: 'testmodel',
      scopes: {
        active: function(qb) {
          qb.innerJoin('teststatus AS S1', 'testmodel.status_id', 'S1.id').
          where({'S1.name': 'Active'});
        }
      }
    });

    var TestStatus = bookshelf.Model.extend({
      tableName: 'teststatus',
    });

    expect(TestModel1.active).to.not.be.undefined;

    return Promise.all([
      TestModel1.forge({name: 'test', status_id: 1}).save(),
      TestModel1.forge({name: 'test2', status_id: 2}).save(),
      TestStatus.forge({name: 'Active'}).save(),
      TestStatus.forge({name: 'NotActive'}).save(),
    ]).then(function() {
      return TestModel1.active().fetchAll().then(function(allActive) {
        expect(allActive.length).to.equal(1);
        expect(allActive.models[0].get('status_id')).to.equal(1);
        expect(allActive.models[0].get('name')).to.equal('test');

      });
    });
  });

  it('can combine scope with a joining where to the same table and fetchAll from db', function() {
    var TestModel1 = bookshelf.Model.extend({
      tableName: 'testmodel',
      scopes: {
        isLive: function(qb) {
          qb.innerJoin('teststatus AS S1', 'testmodel.status_id', 'S1.id').
          where({'S1.name': 'Live'});
        },
        wasStopped: function(qb) {
          qb.innerJoin('teststatus AS S2', 'testmodel.past_status_id', 'S2.id').
          where({'S2.name': 'Stopped'});
        }
      }
    });

    var TestStatus = bookshelf.Model.extend({
      tableName: 'teststatus',
    });

    expect(TestModel1.isLive).to.not.be.undefined;
    expect(TestModel1.wasStopped).to.not.be.undefined;

    return Promise.all([
      TestModel1.forge({name: 'test1', status_id: 1}).save(),
      TestModel1.forge({name: 'test2', status_id: 2, past_status_id: 1}).save(),
      TestModel1.forge({name: 'test3', status_id: 3, past_status_id: 2}).save(),
      TestModel1.forge({name: 'test4', status_id: 3, past_status_id: 4}).save(),
      TestStatus.forge({name: 'Draft'}).save(),
      TestStatus.forge({name: 'Pending'}).save(),
      TestStatus.forge({name: 'Live'}).save(),
      TestStatus.forge({name: 'Stopped'}).save(),
    ]).then(function() {
      return TestModel1.isLive().wasStopped().fetchAll().then(function(allLiveWasStopped) {
        expect(allLiveWasStopped.length).to.equal(1);
        expect(allLiveWasStopped.models[0].get('status_id')).to.equal(3); //Live
        expect(allLiveWasStopped.models[0].get('name')).to.equal('test4');

      });
    });

  });
});
