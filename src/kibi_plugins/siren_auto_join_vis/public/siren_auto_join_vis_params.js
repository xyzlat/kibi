import _ from 'lodash';

import template from 'plugins/siren_auto_join_vis/siren_auto_join_vis_params.html';
import { uiModules } from 'ui/modules';
import 'ui/kibi/components/ontology_client/ontology_client';

uiModules
.get('kibana/siren_auto_join_vis')
.directive('sirenAutoJoinVisParams', function ($rootScope, createNotifier, ontologyClient, savedDashboards,
                                               savedSearches, indexPatterns) {
  return {
    restrict: 'E',
    template,
    link: function ($scope) {
      $scope.buttons = [];

      const notify = createNotifier({
        location: 'Siren Automatic Relational filter params'
      });

      // Updates the buttons to show according to the selected indexpattern.
      $scope.updateFilteredButtons = function () {
        $scope.filteredButtons = _.filter($scope.buttons, (button) => {
          return button.domainIndexPattern === $scope.filterIndexPattern.id || !button.domainIndexPattern;
        });
        $rootScope.$broadcast('siren:auto-join-params:filter:indexpattern', $scope.filterIndexPattern.id);
      };

      /**
       * This functions show the available target dashboards for a given EID relation
       */
      $scope.toggleTargetDashboards = function (button) {
        if (!button.compatibleDashboard) {
          ontologyClient.getRelationById(button.indexRelationId)
          .then((relation) => {
            let entity = relation.domain;
            if (relation.range.type === 'VIRTUAL_ENTITY') {
              entity = relation.range;
            }
            return Promise.all([
              ontologyClient.getDashboardsByEntity(entity),
              ontologyClient.getRelationsByDomain(entity.id)
            ])
            .then(([dashboards, targetRelations]) => {
              const compatibleDashboards = _.map(dashboards, (dashboard) => {
                return dashboard.title;
              });
              _.each(targetRelations, (targetRel) => {
                button.compatibleDashboard = {};
                button.compatibleDashboard[targetRel.directLabel] = compatibleDashboards;
              });
              button.showTargetDashboards = !button.showTargetDashboards;
            });
          });
        } else {
          button.showTargetDashboards = !button.showTargetDashboards;
        }
      };

      $scope.resetVisibility = function () {
        $scope.vis.params.visibility = {};
      };

      $scope.getButtonVisibilityClass = function (button) {
        const visibility = $scope.vis.params.visibility;
        if (!button.tooltip) {
          button.tooltip = {};
        }
        if (visibility[button.id] === undefined || visibility[button.id].button === undefined) {
          button.tooltip.root = 'Default visibility: visible';
          return 'fa fa-eye button-default';
        } else if (visibility[button.id].button) {
          button.tooltip.root = 'Visible';
          return 'fa fa-eye button-set';
        } else {
          button.tooltip.root = 'Not visible';
          return 'fa fa-eye-slash button-set';
        }
      };

      $scope.getRelationVisibilityClass = function (button, relName) {
        const visibility = $scope.vis.params.visibility;
        if (!button.tooltip) {
          button.tooltip = { relation: {} };
        } else if (!button.tooltip.relation) {
          button.tooltip.relation = {};
          button.tooltip.relation[relName] = {};
        }

        let css;
        if (visibility[button.id] && visibility[button.id].relation && visibility[button.id].relation[relName]
          && (visibility[button.id].relation[relName].toggle === true || visibility[button.id].relation[relName].toggle === false)) {
          css = 'button-set';
        } else {
          button.tooltip.relation[relName].tooltip =  'Default visibility: visible';
          css = 'button-default';
        }

        if (visibility[button.id] && visibility[button.id].relation && visibility[button.id].relation[relName]
          && visibility[button.id].relation[relName].toggle === false) {
          button.tooltip.relation[relName].tooltip =  'Not visible';
          css += ' fa-eye-slash';
        } else {
          if (css === 'button-set') {
            button.tooltip.relation[relName].tooltip =  'Visible';
          }
          css += ' fa-eye';
        }

        return css;
      };

      $scope.getDashboardVisibilityClass = function (button, relName, dashboardName) {
        const visibility = $scope.vis.params.visibility;
        if (!button.tooltip) {
          button.tooltip = { relation: {} };
        } else if (!button.tooltip.relation) {
          button.tooltip.relation = {};
          button.tooltip.relation[relName] = { dashboard: {} };
        } else if (!button.tooltip.relation[relName].dashboard) {
          button.tooltip.relation[relName].dashboard = {};
        }

        let css;
        if (visibility[button.id] && visibility[button.id].relation && visibility[button.id].relation[relName]
          && visibility[button.id].relation[relName].dashboard
          && (visibility[button.id].relation[relName].dashboard[dashboardName] === true
            || visibility[button.id].relation[relName].dashboard[dashboardName] === false)) {
          css = 'button-set';
        } else {
          button.tooltip.relation[relName].dashboard[dashboardName] =  'Default visibility: visible';
          css = 'button-default';
        }

        if (visibility[button.id] && visibility[button.id].relation && visibility[button.id].relation[relName]
          && visibility[button.id].relation[relName].dashboard
          && visibility[button.id].relation[relName].dashboard[dashboardName] === false) {
          button.tooltip.relation[relName].dashboard[dashboardName] =  'Not visible';
          css += ' fa-eye-slash';
        } else {
          if (css === 'button-set') {
            button.tooltip.relation[relName].dashboard[dashboardName] =  'Visible';
          }
          css += ' fa-eye';
        }

        return css;
      };

      $scope.toggleButtonVisibility = function (button) {
        let visibility;
        if ($scope.vis.params.visibility[button.id]) {
          visibility = $scope.vis.params.visibility[button.id];
        } else {
          visibility = {};
        }
        // default state
        if (_.isEmpty(visibility)) {
          visibility.button = false;
        } else if (visibility.button) {
          visibility.button = false;
        } else {
          visibility.button = true;
        }

        $scope.vis.params.visibility[button.id] = visibility;
      };

      $scope.toggleRelationVisibility = function (button, relationName) {
        let visibility;
        if ($scope.vis.params.visibility[button.id]) {
          visibility = $scope.vis.params.visibility[button.id];
        } else {
          visibility = {};
        }
        if (!visibility.relation) {
          visibility.relation = {};
        }
        // default state
        if (!visibility.relation[relationName] || visibility.relation[relationName].toggle === undefined) {
          visibility.relation[relationName] = { toggle: false };
        } else {
          visibility.relation[relationName].toggle = !visibility.relation[relationName].toggle;
        }

        $scope.vis.params.visibility[button.id] = visibility;
        return visibility;
      };

      $scope.toggleDashboardVisibility = function (button, relationName, dashboardName) {
        let visibility;
        if ($scope.vis.params.visibility[button.id]) {
          visibility = $scope.vis.params.visibility[button.id];
        } else {
          visibility = {};
        }
        if (!visibility.relation) {
          visibility.relation = {};
          visibility.relation[relationName] = { dashboard: {} };
        }
        if (!visibility.relation[relationName].dashboard) {
          visibility.relation[relationName].dashboard = {};
        }
        // default state
        if (visibility.relation[relationName].dashboard[dashboardName] === undefined) {
          visibility.relation[relationName].dashboard[dashboardName] = false;
        } else {
          visibility.relation[relationName].dashboard[dashboardName] =
            !visibility.relation[relationName].dashboard[dashboardName];
        }

        $scope.vis.params.visibility[button.id] = visibility;
        return visibility;
      };

      // Init the config panel
      Promise.all([
        ontologyClient.getRelations(),
        indexPatterns.getIds()
      ])
      .then(([relations, indexPatternIds]) => {
        indexPatternIds = _.sortBy(indexPatternIds);

        // populate the indexpatterns dropdown to filter relations (buttons)
        $scope.availableIndexPatterns = _.map(indexPatternIds, (indexPatternId) => {
          return { id: indexPatternId, name: indexPatternId };
        });
        // autoselect the first one
        $scope.filterIndexPattern = $scope.availableIndexPatterns[0];

        // check if we have to add buttons for new relations with EIDs
        const relationsWithNoButton = _.filter(relations, (rel) => {
          return rel.domain.type === 'INDEX_PATTERN';
        });

        return Promise.all([
          savedDashboards.find(),
          savedSearches.find()
        ])
        .then(([savedDashboards, savedSearches]) => {
          _.each(relationsWithNoButton, (rel) => {
            const button = {
              indexRelationId: rel.id,
              domainIndexPattern: rel.domain.id,
              status: 'default'
            };
            if (rel.range.type === 'VIRTUAL_ENTITY') {
              button.type = 'VIRTUAL_ENTITY';
              button.id = rel.id + '-ve-' + rel.range.id;
              button.label = rel.directLabel + ' (' + rel.range.id + ')';
              $scope.buttons.push(button);
            } else if (rel.range.type === 'INDEX_PATTERN') {
              button.type = 'INDEX_PATTERN';

              const compatibleSavedSearches = _.filter(savedSearches.hits, (savedSearch) => {
                const searchSource = JSON.parse(savedSearch.kibanaSavedObjectMeta.searchSourceJSON);
                return searchSource.index === rel.range.id;
              });

              _.each(compatibleSavedSearches, (compatibleSavedSearch) => {
                const compatibleDashboards = _.filter(savedDashboards.hits, (savedDashboard) => {
                  return savedDashboard.savedSearchId === compatibleSavedSearch.id;
                });
                _.each(compatibleDashboards, (compatibleDashboard) => {
                  const clonedButton = _.clone(button);
                  clonedButton.label = rel.directLabel + ' (' + compatibleDashboard.title + ')';
                  clonedButton.id = rel.id + '-ip-' + compatibleDashboard.title;
                  $scope.buttons.push(clonedButton);
                });
              });
            }
          });
        })
        .then($scope.updateFilteredButtons);
      });

    }
  };
});
