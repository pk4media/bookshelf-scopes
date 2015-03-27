'use strict';

var expect = require('chai').expect;
var scopes = require('../src/scopes');
var Promise = require('bluebird');

var knex = require('knex')({
  client: 'sqlite3',
  connection: { filename: "./mytestdb" }
});

var bookshelf = require('bookshelf')(knex);
bookshelf.plugin(scopes);

describe('scopes - default', function() {

  beforeEach(function() {
    return bookshelf.knex.schema.hasTable('testmodel').then(function(exists){
      if (exists) {
        return bookshelf.knex.schema.dropTable('testmodel');
      }
    }).then(function() {
      return bookshelf.knex.schema.createTable('testmodel', function (table) {
        table.increments();
        table.string('name');
        table.string('status');
        table.timestamps();
      });
    });
  });

  it('can set default scope and fetchAll using it', function() {
    var TestModel1 = bookshelf.Model.extend({
      tableName: 'testmodel',
      scopes: {
        default: function(qb) {
          qb.where({status: 'Active'});
        }
      }
    });

    expect(TestModel1.default).to.not.be.undefined;

    return Promise.all([
      TestModel1.forge({name: 'test', status: 'Active'}).save(),
      TestModel1.forge({name: 'test2', status: 'NotActive'}).save(),
      TestModel1.forge({name: 'test3', status: 'NotActive'}).save(),
    ]).then(function() {
      return TestModel1.fetchAll().then(function(allActive) {
        expect(allActive.length).to.equal(1);
        expect(allActive.models[0].get('status')).to.equal('Active');
        expect(allActive.models[0].get('name')).to.equal('test');

      });
    });
  });

  it('can set default scope and fetch using it', function() {
    var TestModel1 = bookshelf.Model.extend({
      tableName: 'testmodel',
      scopes: {
        default: function(qb) {
          qb.where({status: 'Active'});
        }
      }
    });

    expect(TestModel1.default).to.not.be.undefined;

    return Promise.all([
      TestModel1.forge({name: 'test', status: 'Active'}).save(),
      TestModel1.forge({name: 'test2', status: 'NotActive'}).save(),
      TestModel1.forge({name: 'test3', status: 'NotActive'}).save(),
    ]).then(function() {
      return TestModel1.where(knex.raw('1 = 1')).fetch().then(function(item) {
        expect(item.get('status')).to.equal('Active');
        expect(item.get('name')).to.equal('test');

      });
    });
  });

  it('can reset default scope and fetchAll not using it', function() {
    var TestModel1 = bookshelf.Model.extend({
      tableName: 'testmodel',
      scopes: {
        default: function(qb) {
          qb.where({status: 'Active'});
        }
      }
    });

    expect(TestModel1.default).to.not.be.undefined;

    return Promise.all([
      TestModel1.forge({name: 'test', status: 'Active'}).save(),
      TestModel1.forge({name: 'test2', status: 'NotActive'}).save(),
      TestModel1.forge({name: 'test3', status: 'NotActive'}).save(),
    ]).then(function() {
      return TestModel1.unscoped().fetchAll().then(function(allModels) {
        expect(allModels.length).to.equal(3);
      });
    });
  });

  it('in default scope can use another scope function', function() {
    var TestModel1 = bookshelf.Model.extend({
      tableName: 'testmodel',
      scopes: {
        active: function(qb) {
          qb.where({status: 'Active'});
        },
        default: function(qb) {
          this.active(qb);
        }
      }
    });

    expect(TestModel1.active).to.not.be.undefined;
    expect(TestModel1.default).to.not.be.undefined;

    return Promise.all([
      TestModel1.forge({name: 'test', status: 'Active'}).save(),
      TestModel1.forge({name: 'test2', status: 'NotActive'}).save(),
      TestModel1.forge({name: 'test3', status: 'NotActive'}).save(),
    ]).then(function() {
      return TestModel1.fetchAll().then(function(allActive) {
        expect(allActive.length).to.equal(1);
        expect(allActive.models[0].get('status')).to.equal('Active');
        expect(allActive.models[0].get('name')).to.equal('test');

      });
    });
  });

});
