'use strict';

var expect = require('chai').expect;
var Promise = require('bluebird');

var knex = require('knex')({
  client: 'sqlite3',
  connection: { filename: "./mytestdb" }
});

var bookshelf = require('bookshelf')(knex);
bookshelf.plugin(require('../src/scopes'));

describe('scopes - related scope', function() {

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
          table.integer('testrole_id');
          table.timestamps();
          table.boolean('archived');
        });
      }),
      bookshelf.knex.schema.hasTable('testrole').then(function(exists){
        if (exists) {
          return bookshelf.knex.schema.dropTable('testrole');
        }
      }).then(function() {
        return bookshelf.knex.schema.createTable('testrole', function (table) {
          table.increments();
          table.string('name');
        });
      }),
      bookshelf.knex.schema.hasTable('testjoin').then(function(exists) {
        if (exists) {
          return bookshelf.knex.schema.dropTable('testjoin');
        }
      }).then(function() {
        return bookshelf.knex.schema.createTable('testjoin', function(table) {
          table.increments();
          table.integer('testmodel_id');
          table.integer('testrole_id');
        });
      })
    ]);
  });

  it('default scope is on related data fetch', function() {

    var TestModel1 = bookshelf.Model.extend({
      tableName: 'testmodel',
      scopes: {
        default: function(qb) {
          qb.where({'archived': false});
        }
      }
    });

    var TestRole = bookshelf.Model.extend({
      tableName: 'testrole',
      test_models: function() {
        return this.hasMany(TestModel1);
      }
    });

    return Promise.all([
      TestModel1.forge({name: 'test', testrole_id: 1}).save(),
      TestModel1.forge({name: 'test2', testrole_id: 2}).save(),
      TestRole.forge({name: 'Company'}).save(),
      TestRole.forge({name: 'Region'}).save()
    ]).then(function() {
      return TestRole.fetchAll({
        withRelated: ['test_models']
      }).then(function(allRoles) {
        expect(allRoles.length).to.equal(2);
        allRoles.forEach(function(role) {
          expect(role.related('test_models').length).to.equal(0);
        });
      });
    });
  });

  it('default scope is on related data fetch with through', function() {

    var TestModel1 = bookshelf.Model.extend({
      tableName: 'testmodel',
      scopes: {
        default: function(qb) {
          qb.where({'archived': false});
        }
      }
    });

    var TestJoin = bookshelf.Model.extend({
      tableName: 'testjoin'
    })

    var TestRole = bookshelf.Model.extend({
      tableName: 'testrole',
      test_models: function() {
        return this.belongsToMany(TestModel1).through(TestJoin);
      }
    });

    return Promise.all([
      TestModel1.forge({name: 'test', testrole_id: 1}).save(),
      TestModel1.forge({name: 'test2', testrole_id: 2}).save(),
      TestRole.forge({name: 'Company'}).save(),
      TestRole.forge({name: 'Region'}).save()
    ]).then(function() {
      return TestRole.fetchAll({
        withRelated: ['test_models']
      }).then(function(allRoles) {
        expect(allRoles.length).to.equal(2);
        allRoles.forEach(function(role) {
          expect(role.related('test_models').length).to.equal(0);
        });
      });
    });
  });
});
