'use strict';

var expect = require('chai').expect;
var Promise = require('bluebird');

var knex = require('knex')({
  client: 'sqlite3',
  connection: { filename: "./mytestdb" }
});

var bookshelf = require('bookshelf')(knex);
bookshelf.plugin(require('../src/scopes'));

describe('scopes - collection', function() {

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
      });
    }).then(function () {
      return knex('testmodel').insert([
        {name: 'test', status: 'Active'},
        {name: 'test1', status: 'Active'},
        {name: 'test2', status: 'NotActive'},
      ]);
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

    var TestCollection1 = bookshelf.Collection.extend({
      model: TestModel1
    });

    expect(TestCollection1.active).to.not.be.undefined;
    
    return TestCollection1.active().fetch().then(function(allActive) {
      expect(allActive.length).to.equal(2);
      expect(allActive.models[0].get('status')).to.equal('Active');
      expect(allActive.models[0].get('name')).to.equal('test');
      expect(allActive.models[1].get('status')).to.equal('Active');
      expect(allActive.models[1].get('name')).to.equal('test1');
    });
  });

  it('can add simple scope method with a where and fetchOne from db', function() {

    var TestModel1 = bookshelf.Model.extend({
      tableName: 'testmodel',
      scopes: {
        active: function(qb) {
          qb.where({status: 'Active'});
        }
      }
    });

    var TestCollection1 = bookshelf.Collection.extend({
      model: TestModel1
    });

    expect(TestCollection1.active).to.not.be.undefined;

    return TestCollection1.active().fetchOne().then(function(testModel) {
      expect(testModel.get('status')).to.equal('Active');
      expect(testModel.get('name')).to.equal('test');
    });
  });

  it('can add combine scope methods and fetchOne from db', function() {

    var TestModel1 = bookshelf.Model.extend({
      tableName: 'testmodel',
      scopes: {
        active: function(qb) {
          qb.where({status: 'Active'});
        },
        nameLike: function(qb, name) {
          qb.where(knex.raw('name LIKE ?', '%' + name + '%'));
        }
      }
    });

    var TestCollection1 = bookshelf.Collection.extend({
      model: TestModel1
    });

    expect(TestCollection1.active).to.not.be.undefined;
    expect(TestCollection1.nameLike).to.not.be.undefined;

    return TestCollection1.active().nameLike('1').fetchOne().then(function(testModel) {
      expect(testModel.get('status')).to.equal('Active');
      expect(testModel.get('name')).to.equal('test1');
    });
  });

  it('can add combine scope methods in scope and fetch from db', function() {

    var TestModel1 = bookshelf.Model.extend({
      tableName: 'testmodel',
      scopes: {
        active: function(qb) {
          qb.where({status: 'Active'});
        },
        nameLike: function(qb, name) {
          qb.where(knex.raw('name LIKE ?', '%' + name + '%'));
        },
        activeNameLike: function(qb, name) {
          this.active(qb)
          this.nameLike(qb, name);
        }
      }
    });

    var TestCollection1 = bookshelf.Collection.extend({
      model: TestModel1
    });

    expect(TestCollection1.active).to.not.be.undefined;
    expect(TestCollection1.nameLike).to.not.be.undefined;

    return TestCollection1.activeNameLike('1').fetch().then(function(allActive) {
      expect(allActive.length).to.equal(1);
      expect(allActive.models[0].get('status')).to.equal('Active');
      expect(allActive.models[0].get('name')).to.equal('test1');
    });
  });

  it('can add combine scope methods from base model and fetchOne from db', function() {

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
          qb.where(knex.raw('name LIKE ?', '%' + name + '%'));
        }
      }
    });

    var TestCollection1 = bookshelf.Collection.extend({
      model: TestModel1
    });

    expect(TestCollection1.active).to.not.be.undefined;
    expect(TestCollection1.nameLike).to.not.be.undefined;

    return TestCollection1.active().nameLike('1').fetchOne().then(function(testModel) {
      expect(testModel.get('status')).to.equal('Active');
      expect(testModel.get('name')).to.equal('test1');
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

    var TestCollection1 = bookshelf.Collection.extend({
      model: TestModel1
    });

    expect(TestCollection1.active).to.be.undefined;

    return TestCollection1.forge().fetch().then(function(allModels) {
      expect(allModels.length).to.equal(3);
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

    var TestCollection1 = bookshelf.Collection.extend({
      model: TestModel1
    });

    return TestCollection1.forge().fetch().then(function(allModels) {
      expect(allModels.length).to.equal(2);
      expect(allModels.models[0].newValue).to.equal(1);
      expect(allModels.models[1].newValue).to.equal(1);
    });
  });

  it('collection scopes should get inherited from model', function() {

    var TestModel1 = bookshelf.Model.extend({
      tableName: 'testmodel',
      scopes: {
        active: function(qb) {
          qb.where({status: 'Active'});
        }
      }
    });

    return TestModel1.collection().active().fetch().then(function(allModels) {
      expect(allModels.length).to.equal(2);
    });
  });

});
