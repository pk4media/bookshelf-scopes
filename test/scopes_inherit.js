'use strict';

var expect = require('chai').expect;
var Promise = require('bluebird');

var knex = require('knex')({
  client: 'sqlite3',
  connection: { filename: "./mytestdb" }
});

var bookshelf = require('bookshelf')(knex);
bookshelf.plugin(require('../src/scopes'));

describe('scopes - inherited scope', function() {

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
    var TestModelBase = bookshelf.Model.extend({
      scopes: {
        active: function(qb) {
          qb.where(this.tableName + '.status', '=', 'Active');
        }
      }
    });

    var TestModel1 = TestModelBase.extend({
      tableName: 'testmodel'
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
    var TestModelBase = bookshelf.Model.extend({
      scopes: {
        active: function(qb) {
          qb.where(this.tableName + '.status', '=', 'Active');
        }
      }
    });

    var TestModel1 = TestModelBase.extend({
      tableName: 'testmodel'
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
    var TestModelBase = bookshelf.Model.extend({
      scopes: {
        active: function(qb) {
          qb.where(this.tableName + '.status', '=', 'Active');
        }
      }
    });

    var TestModel1 = TestModelBase.extend({
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

  it('can add combine scope methods in scope and fetchAll from db', function() {
    var TestModelBase = bookshelf.Model.extend({
      scopes: {
        active: function(qb) {
          qb.where(this.tableName + '.status', '=', 'Active');
        }
      }
    });

    var TestModel1 = TestModelBase.extend({
      tableName: 'testmodel',
      scopes: {
        nameLike: function(qb, name) {
          qb.where(knex.raw('name LIKE ?', name + '%'));
        },
        activeNameLike: function(qb, name) {
          this.active(qb);
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

  it('only gets scopes from its parent', function() {
    var TestModelBase = bookshelf.Model.extend({
      scopes: {
        active: function(qb) {
          qb.where(this.tableName + '.status', '=', 'Active');
        }
      }
    });

    var TestModel1 = TestModelBase.extend({
      tableName: 'testmodel',
      scopes: {
        nameLike: function(qb, name) {
          qb.where(knex.raw('name LIKE ?', name + '%'));
        },
        activeNameLike: function(qb, name) {
          this.active(qb);
          this.nameLike(qb, name);
        }
      }
    });

    var TestModel2 = bookshelf.Model.extend({
      scopes: {
        notActive: function(qb) {
          qb.where(this.tableName + '.status', '!=', 'Active');
        }
      }
    });

    expect(TestModel1.prototype.scopes.active).to.not.be.undefined;
    expect(TestModel2.prototype.scopes.active).to.be.undefined;
  });

  it("default override behaves properly", function() {
    var TestModelBase = bookshelf.Model.extend({
      name: 'TestModelBase',
      tableName: 'testmodel',
      scopes: {
        default: function(qb) {
          qb.orderBy('id', 'DESC');
        }
      }
    });

    var TestModel1 = TestModelBase.extend({
      name: 'TestModel1',
      scopes: {
        default: function(qb) {
          qb.where('testmodel.status', '=', 'Active');
        },
      }
    });

    var TestModel2 = bookshelf.Model.extend({
      name: 'TestModel2',
      scopes: {
        default: function(qb) {
          qb.where('testmodel.status', '=', 'NotActive');
        }
      }
    });

    return Promise.all([
      TestModelBase.forge({name: 'test1', status: 'Active'}).save(),
      TestModelBase.forge({name: 'test2', status: 'NotActive'}).save(),
    ]).then(function() {
      return Promise.all([
        TestModel1.fetchAll().then(function(allActive) {
          expect(allActive.length).to.equal(1);
          expect(allActive.models[0].get('status')).to.equal('Active');
          expect(allActive.models[0].get('name')).to.equal('test1');
        }),
        TestModelBase.fetchAll().then(function(all) {
          expect(all.length).to.equal(2);
        }),
        TestModel1.fetchAll().then(function(allActive) {
          expect(allActive.length).to.equal(1);
          expect(allActive.models[0].get('status')).to.equal('Active');
          expect(allActive.models[0].get('name')).to.equal('test1');
        }),
        TestModelBase.fetchAll().then(function(all) {
          expect(all.length).to.equal(2);
        })
      ]);
    });
  });

});
