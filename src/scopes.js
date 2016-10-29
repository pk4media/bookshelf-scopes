'use strict';

var _ = require('lodash');

var applyScope = function (_this, applier) {
  return function (qb) {
    var tempStatements = qb._statements.slice();

    // Apply scope
    applier.call(_this, qb);

    // Find added statements
    _.difference(qb._statements, tempStatements)
    // Memorize scoped statements
    .forEach(function (statement) {
      _this.unscoped.scopeStatements.push(statement);
    });
  };
}

module.exports = function(bookshelf) {
  var ModelCtor = bookshelf.Model;
  var CollectionCtor = bookshelf.Collection;
  // `bookshelf.knex()` was deprecated in knex v0.8.0, use `knex.queryBuilder()` instead if available
  var QueryBuilder = (bookshelf.knex.queryBuilder) ? bookshelf.knex.queryBuilder().constructor : bookshelf.knex().constructor;

  var extended = function(Target) {
    
    // Model/Collection abstraction
    var isModel = !this.prototype.model;

    var Ctor = isModel ? ModelCtor: CollectionCtor;

    if (_.isFunction(Ctor.extended) && this.extended != Ctor.extended) {
      Ctor.extended(Target);
    }

    // Parent model
    var Model = isModel ? this : Target.prototype.model;

    // Inherit scopes from parent
    Target.prototype.scopes = _.defaults({}, Target.prototype.scopes || {}, Model.prototype.scopes || {});

    // Scopes as prototype methods
    Object.keys(Target.prototype.scopes).forEach(function(property) {
      Target.prototype[property] = function() {
        var _this = this;
        var passedInArguments = _.toArray(arguments);

        return this.query(applyScope(this, function(qb) {
          if (passedInArguments.length == 0 || !(passedInArguments[0] instanceof QueryBuilder)) {
            passedInArguments.unshift(qb);
          }
          _this.scopes[property].apply(_this, passedInArguments);
        }));
      };

      Target[property] = function() {
        var instance = Target.forge();
        return instance[property].apply(instance, arguments);
      };
    });
  };

  var abstractProperties = [{

    scopes: null,

    initialize: function() {
      var superInitialize = (this instanceof ModelCtor
        ? ModelCtor
        : CollectionCtor).prototype.initialize;
      this.unscoped.scopeStatements = [];
      superInitialize.apply(this, arguments);
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

    extended: extended,

    collection: function () {
      var Collection = bookshelf.Collection.extend({model: this});
      return new (Function.prototype.bind.apply(Collection, [null].concat(Array.prototype.slice.call(arguments))))();
    },

    unscoped: function() {
      return this.forge().unscoped();
    }
  }];

  var Model = ModelCtor.extend.apply(ModelCtor, abstractProperties);
  delete abstractProperties[1].collection;
  var Collection = CollectionCtor.extend.apply(CollectionCtor, abstractProperties);

  bookshelf.Model = Model;
  bookshelf.Collection = Collection;
};
