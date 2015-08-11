'use strict';

var _ = require('lodash');

module.exports = function(bookshelf) {
  var base = bookshelf.Model;
  var baseExtend = bookshelf.Model.extend;
  // `bookshelf.knex()` was deprecated in knex v0.8.0, use `knex.queryBuilder()` instead if available
  var QueryBuilder = (bookshelf.knex.queryBuilder) ? bookshelf.knex.queryBuilder().constructor : bookshelf.knex().constructor;

  bookshelf.Model.extend = function(protoProps, constructorProps) {
    var model = baseExtend.apply(this, arguments);

    model.prototype.scopes = model.prototype.scopes || {};

    _.defaults(model.prototype.scopes, this.prototype.scopes || {});

    Object.keys(model.prototype.scopes).forEach(function(property) {
      model.prototype[property] = function() {
        var _this = this;
        var passedInArguments = _.toArray(arguments);

        if (passedInArguments.length > 0 && passedInArguments[0] instanceof QueryBuilder) {
          this.scopes[property].apply(this, passedInArguments);

          return this;
        } else {
          return this.query(function(qb) {
            passedInArguments.unshift(qb);
            _this.scopes[property].apply(_this, passedInArguments);
          });
        }
      };

      model[property] = function() {
        var instance = model.forge();
        return instance[property].apply(instance, arguments);
      };
    });

    _.each(['hasMany', 'hasOne', 'belongsToMany', 'morphOne', 'morphMany',
      'belongsTo', 'through'], function(method) {
      var original = model.prototype[method];
      model.prototype[method] = function() {
        var relationship = original.apply(this, arguments);
        var target = relationship.model || relationship.relatedData.target;
        var originalSelectConstraints = relationship.relatedData.selectConstraints;

        if (target.prototype.scopes) {
          relationship.relatedData.selectConstraints = function(knex, options) {
            originalSelectConstraints.apply(this, arguments);
            if (target.prototype.scopes.default) {
              if (!knex.appliedDefault) {
                knex.appliedDefault = true;
                target.prototype.scopes.default.apply(this, [knex, options]);
              }
            }
          };

          Object.keys(target.prototype.scopes).forEach(function(key) {
            relationship[key] = function() {
              var passedInArguments = _.toArray(arguments);
              var currentSelectConstraints = relationship.relatedData.selectConstraints;
              relationship.relatedData.selectConstraints = function(knex, options) {
                currentSelectConstraints.apply(this, arguments);
                passedInArguments.unshift(knex);
                target.prototype.scopes[key].apply(target.prototype, passedInArguments);
              };
              return relationship;
            };
          });

          relationship.unscoped = function() {
            relationship.relatedData.selectConstraints = function(knex, options) {

              var originalDefaultScope;
              if(target.prototype.scopes && target.prototype.scopes.default) {
                originalDefaultScope = target.prototype.scopes.default;
                delete target.prototype.scopes.default;
              }

              originalSelectConstraints.apply(this, arguments);

              if (originalDefaultScope) {
                target.prototype.scopes.default = originalDefaultScope;
              }
            };
            return relationship;
          };
        }

        return relationship;

      };
    });

    return model;
  };

  var Model = bookshelf.Model.extend({

    scopes: null,

    initialize: function() {
      this.addScope();
    },

    addScope: function() {
      var self = this;
      if (self.scopes && self.scopes.default) {
        self.query(function(qb) {
          if (!qb.appliedDefault) {
            qb.appliedDefault = true;
            self.scopes.default.call(self, qb);
          }
        });
      }
    },

    unscoped: function() {
      return this.resetQuery();
    }
  }, {
    unscoped: function() {
      return this.forge().unscoped();
    }
  });

  bookshelf.Model = Model;
};
