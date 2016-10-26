'use strict';

var expect = require('chai').expect;
var Promise = require('bluebird');

var knex = require('knex')({
  client: 'sqlite3',
  connection: { filename: "./mytestdb" }
});

var bookshelf = require('bookshelf')(knex);
bookshelf.plugin(require('../src/scopes'));

describe('scopes - basic scope', function() {

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

  it('can add simple scope method with a where and fetchAll from db', function() {

    var TestModel1 = bookshelf.Model.extend({
      tableName: 'testmodel',
      scopes: {
        active: function(qb) {
          qb.where({status: 'Active'});
        }
      }
    });

    expect(TestModel1.active).to.not.be.undefined;

    return Promise.all([
        TestModel1.forge({name: 'test', status: 'Active'}).save(),
        TestModel1.forge({name: 'test2', status: 'NotActive'}).save(),
      ]).then(function() {
        return TestModel1.active().fetchAll().then(function(allActive) {
          expect(allActive.length).to.equal(1);
          expect(allActive.models[0].get('status')).to.equal('Active');
          expect(allActive.models[0].get('name')).to.equal('test');

      });
    });
  });

  it('can add simple scope method with a where and fetch from db', function() {

    var TestModel1 = bookshelf.Model.extend({
      tableName: 'testmodel',
      scopes: {
        active: function(qb) {
          qb.where({status: 'Active'});
        }
      }
    });

    expect(TestModel1.active).to.not.be.undefined;

    return Promise.all([
      TestModel1.forge({name: 'test', status: 'Active'}).save(),
      TestModel1.forge({name: 'test2', status: 'NotActive'}).save(),
    ]).then(function() {
      return TestModel1.active().fetch().then(function(testModel) {
        expect(testModel.get('status')).to.equal('Active');
        expect(testModel.get('name')).to.equal('test');

      });
    });
  });

  it('can add combine scope methods and fetchAll from db', function() {

    var TestModel1 = bookshelf.Model.extend({
      tableName: 'testmodel',
      scopes: {
        active: function(qb) {
          qb.where({status: 'Active'});
        },
        nameLike: function(qb, name) {
          qb.where(knex.raw('name LIKE ?', name + '%'));
        }
      }
    });

    expect(TestModel1.active).to.not.be.undefined;
    expect(TestModel1.nameLike).to.not.be.undefined;

    return Promise.all([
      TestModel1.forge({name: 'test1', status: 'Active'}).save(),
      TestModel1.forge({name: 'test2', status: 'NotActive'}).save(),
    ]).then(function() {
      return TestModel1.active().nameLike('test').fetch().then(function(testModel) {
        expect(testModel.get('status')).to.equal('Active');
        expect(testModel.get('name')).to.equal('test1');
      });
    });
  });

  it('can add combine scope methods in scope and fetchAll from db', function() {

    var TestModel1 = bookshelf.Model.extend({
      tableName: 'testmodel',
      scopes: {
        active: function(qb) {
          qb.where({status: 'Active'});
        },
        nameLike: function(qb, name) {
          qb.where(knex.raw('name LIKE ?', name + '%'));
        },
        activeNameLike: function(qb, name) {
          this.active(qb)
          this.nameLike(qb, name);
        }
      }
    });

    expect(TestModel1.active).to.not.be.undefined;
    expect(TestModel1.nameLike).to.not.be.undefined;

    return Promise.all([
      TestModel1.forge({name: 'test1', status: 'Active'}).save(),
      TestModel1.forge({name: 'test2', status: 'NotActive'}).save(),
    ]).then(function() {
      return TestModel1.activeNameLike('test').fetchAll().then(function(allActive) {
        expect(allActive.length).to.equal(1);
        expect(allActive.models[0].get('status')).to.equal('Active');
        expect(allActive.models[0].get('name')).to.equal('test1');
      });
    });
  });

  it('can add combine scope methods from base model and fetchAll from db', function() {

    var TestModelBase = bookshelf.Model.extend({
      name: 'TestModelBase',
      scopes: {
        active: function(qb) {
          qb.where({status: 'Active'});
        }
      }
    });

    var TestModel1 = TestModelBase.extend({
      name: 'TestModel1',
      tableName: 'testmodel',
      scopes: {
        nameLike: function(qb, name) {
          qb.where(knex.raw('name LIKE ?', name + '%'));
        }
      }
    });

    expect(TestModel1.active).to.not.be.undefined;
    expect(TestModel1.nameLike).to.not.be.undefined;

    return Promise.all([
      TestModel1.forge({name: 'test1', status: 'Active'}).save(),
      TestModel1.forge({name: 'test2', status: 'NotActive'}).save(),
    ]).then(function() {
      return TestModel1.active().nameLike('test').fetch().then(function(testModel) {
        expect(testModel.get('status')).to.equal('Active');
        expect(testModel.get('name')).to.equal('test1');
      });
    });
  });

  it('no scope doesnt break existing bookshelf logic', function() {

    var TestModelBase = bookshelf.Model.extend({
      scopes: {
        active: function(qb) {
          qb.where({status: 'Active'});
        }
      }
    });

    var TestModel1 = bookshelf.Model.extend({
      name: 'TestModel1',
      tableName: 'testmodel',
    });

    expect(TestModel1.active).to.be.undefined;

    return Promise.all([
      TestModel1.forge({name: 'test', status: 'Active'}).save(),
      TestModel1.forge({name: 'test2', status: 'NotActive'}).save(),
    ]).then(function() {
      return TestModel1.fetchAll().then(function(allModels) {
        expect(allModels.length).to.equal(2);
      });
    });
  });

  it('if you set an initialize your logic gets called as well', function() {

    var TestModel1 = bookshelf.Model.extend({
      tableName: 'testmodel',
      scopes: {
        default: function(qb) {
          qb.where({status: 'Active'});
        }
      },
      initialize: function() {
        this.addScope(); //Need to add scope on initialize if you are replacing it
        this.newValue = 1;
      }
    });

    return Promise.all([
      TestModel1.forge({name: 'test', status: 'Active'}).save(),
      TestModel1.forge({name: 'test2', status: 'NotActive'}).save(),
    ]).then(function() {
      return TestModel1.fetchAll().then(function(allModels) {
        expect(allModels.length).to.equal(1);
        expect(allModels.models[0].newValue).to.equal(1);
      });
    });
  });

  it('plugin initialize calls super initialize (#10)', function() {
    var superInitializeCalled = 0;
    var bookshelf = require('bookshelf')(knex);
    bookshelf.Model = bookshelf.Model.extend({
      initialize: function() {
        superInitializeCalled++;
      }
    });
    bookshelf.plugin(require('../src/scopes'));
    var TestModel1 = bookshelf.Model.extend({
      tableName: 'testmodel'
    });

    TestModel1.forge({name: 'test', status: 'Active'});
    expect(superInitializeCalled).to.equal(1);
  });

});
