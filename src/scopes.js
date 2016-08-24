'use strict';

var _ = require('lodash');

var applyScope = function (_this, applier) {
  return function (qb) {
    var tempStatements = qb._statements.slice();

    // Apply scope
    applier.call(_this, qb);

    // Find added statements
    qb._statements.filter(function (statement) {
      return !tempStatements.some(_.matches(statement));
    // Memorize scoped statements
    }).forEach(function (statement) {
      _this.unscoped.scopeStatements.push(statement);
    })
  };
}

module.exports = function(bookshelf) {
  var ModelCtor = bookshelf.Model;
  var CollectionCtor = bookshelf.Collection;
  // `bookshelf.knex()` was deprecated in knex v0.8.0, use `knex.queryBuilder()` instead if available
  var QueryBuilder = (bookshelf.knex.queryBuilder) ? bookshelf.knex.queryBuilder().constructor : bookshelf.knex().constructor;

  var extend = function(protoProps, constructorProps) {
    // Model/Collection abstraction
    var isModel = !this.prototype.model;
    var baseExtend = isModel
      ? ModelCtor.extend
      : CollectionCtor.extend;

    // Call unmodified `extend`
    var target = baseExtend.apply(this, arguments);

    // Parent model
    var Model = isModel ? this : target.prototype.model;

    // Inherit scopes from parent
    target.prototype.scopes = _.defaults({}, target.prototype.scopes || {}, Model.prototype.scopes || {});

    // Scopes as prototype methods
    Object.keys(target.prototype.scopes).forEach(function(property) {
      target.prototype[property] = function() {
        var _this = this;
        var passedInArguments = _.toArray(arguments);

        return this.query(applyScope(this, function(qb) {
          if (passedInArguments.length == 0 || !(passedInArguments[0] instanceof QueryBuilder)) {
            passedInArguments.unshift(qb);
          }
          _this.scopes[property].apply(_this, passedInArguments);
        }));
      };

      target[property] = function() {
        var instance = target.forge();
        return instance[property].apply(instance, arguments);
      };
    });

    return target;
  };

  var abstractProperties = [{

    scopes: null,

    initialize: function() {
      var superInitialize = (this instanceof ModelCtor
        ? ModelCtor
        : CollectionCtor).prototype.initialize;
      this.unscoped.scopeStatements = [];
      superInitialize.call(this);
      this.addScope();
    },

    addScope: function() {
      var self = this;
      if (self.scopes && self.scopes.default) {
        self.query(applyScope(this, function(qb) {
          if (!qb.appliedDefault) {
            self.scopes.default.call(self, qb);
          }
        }));
      }
    },

    unscoped: function() {
      var unscoped = this.unscoped;
      return this.query(function function_name(qb) {
        // Remove scoped statements
        _.remove(qb._statements, function (statement) {
          return unscoped.scopeStatements.some(_.matches(statement));
        });
        // Clear scoped statements registry
        unscoped.scopeStatements = [];
        // and default applied state
        qb.appliedDefault = false;
      });
    }
  }, {

    extend: extend,

    collection: function () {
      var Collection = bookshelf.Collection.extend({model: this});
      return new (Function.prototype.bind.apply(Collection, [null].concat(Array.prototype.slice.call(arguments))))();
    },

    unscoped: function() {
      return this.forge().unscoped();
    }
  }];

  var Model = extend.apply(ModelCtor, abstractProperties);
  delete abstractProperties[1].collection;
  var Collection = extend.apply(CollectionCtor, abstractProperties);

  bookshelf.Model = Model;
  bookshelf.Collection = Collection;
};
