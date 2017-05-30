import _ from 'lodash';
import 'ui/visualize';
import 'ui/doc_table';
import * as columnActions from 'ui/doc_table/actions/columns';
import 'plugins/kibana/dashboard/panel/get_object_loaders_for_dashboard';
import FilterManagerProvider from 'ui/filter_manager';
import uiModules from 'ui/modules';
import panelTemplate from 'plugins/kibana/dashboard/panel/panel.html';
import DoesVisDependsOnSelectedEntitiesProvider from 'ui/kibi/components/commons/_does_vis_depends_on_selected_entities';
import { getPersistedStateId } from 'plugins/kibana/dashboard/panel/panel_state';
import { loadSavedObject } from 'plugins/kibana/dashboard/panel/load_saved_object';
import { DashboardViewMode } from '../dashboard_view_mode';

uiModules
.get('app/dashboard')
.directive('dashboardPanel', function (savedVisualizations, savedSearches, Private, $injector, getObjectLoadersForDashboard,
  sessionStorage, kibiState) {
  const filterManager = Private(FilterManagerProvider);
  const doesVisDependsOnSelectedEntities = Private(DoesVisDependsOnSelectedEntitiesProvider);

  const services = require('plugins/kibana/management/saved_object_registry').all().map(function (serviceObj) {
    const service = $injector.get(serviceObj.service);
    return {
      type: service.type,
      name: serviceObj.service
    };
  });

  return {
    restrict: 'E',
    template: panelTemplate,
    scope: {
      /**
       * toggle borders around panels
       * @author kibi
       */
      hideBorders: '=',
      /**
       * What view mode the dashboard is currently in - edit or view only.
       * @type {DashboardViewMode}
       */
      dashboardViewMode: '=',
      /**
       * Whether or not the dashboard this panel is contained on is in 'full screen mode'.
       * @type {boolean}
       */
      isFullScreenMode: '=',
      /**
       * Used to create a child persisted state for the panel from parent state.
       * @type {function} - Returns a {PersistedState} child uiState for this scope.
       */
      createChildUiState: '=',
      /**
       * Contains information about this panel.
       * @type {PanelState}
       */
      panel: '=',
      /**
       * Handles removing this panel from the grid.
       * @type {function}
       */
      remove: '&',
      /**
       * Expand or collapse the current panel, so it either takes up the whole screen or goes back to its
       * natural size.
       * @type {function}
       */
      toggleExpand: '&',
      /**
       * @type {boolean}
       */
      isExpanded: '=',
      /**
       * Returns a click handler for a visualization.
       * @type {function}
       */
      getVisClickHandler: '=',
      /**
       * Returns a brush event handler for a visualization.
       * @type {function}
       */
      getVisBrushHandler: '=',
      /**
       * Call when changes should be propagated to the url and thus saved in state.
       * @type {function}
       */
      saveState: '='
    },
    link: function ($scope, element) {
      if (!$scope.panel.id || !$scope.panel.type) return;

      // kibi: allows restore the uiState after click edit visualization on dashboard
      $scope.edit = function () {
        if ($scope.panel.type === savedVisualizations.type && $scope.savedObj.vis) {
          sessionStorage.set('kibi_panel_id', {
            id: $scope.savedObj.vis.id,
            panel: getPersistedStateId($scope.panel),
            updated: false
          });
          sessionStorage.set('kibi_ui_state', $scope.savedObj.vis.getUiState().toJSON());
        }
        window.location.href = $scope.editUrl;
      };
      // kibi: end

      /**
       * Initializes the panel for the saved object.
       * @param {{savedObj: SavedObject, editUrl: String}} savedObjectInfo
       */
      function initializePanel(savedObjectInfo) {
        $scope.savedObj = savedObjectInfo.savedObj;
        $scope.editUrl = savedObjectInfo.editUrl;

        element.on('$destroy', function () {
          $scope.savedObj.destroy();
          $scope.$destroy();
        });

        // kibi: For some unknown reason the vis object doesn't has his own id. This must be investigated in the future.
        // See issue https://github.com/sirensolutions/kibi-internal/issues/2909
        $scope.savedObj.vis.id = $scope.panel.id;
        // kibi: end

        // kibi: added handle the entity selection events
        $scope.dependsOnSelectedEntities = false;
        if ($scope.panel.type === savedVisualizations.type && $scope.savedObj.vis) {
          // there could be no vis object if we visualise saved search
          doesVisDependsOnSelectedEntities($scope.savedObj.vis).then(function (does) {
            $scope.dependsOnSelectedEntities = does;
          });
        }

        $scope.markDependOnSelectedEntities = Boolean(kibiState.getEntityURI());
        $scope.selectedEntitiesDisabled = kibiState.isSelectedEntityDisabled();

        // react to changes about the selected entity
        $scope.$listen(kibiState, 'save_with_changes', (diff) => {
          if (diff.indexOf(kibiState._properties.selected_entity) !== -1 ||
              diff.indexOf(kibiState._properties.selected_entity_disabled) !== -1) {
            $scope.markDependOnSelectedEntities = Boolean(kibiState.getEntityURI());
            $scope.selectedEntitiesDisabled = kibiState.isSelectedEntityDisabled();
          }
        });
        // kibi: end

        // create child ui state from the savedObj
        const uiState = $scope.savedObj.uiStateJSON ? JSON.parse($scope.savedObj.uiStateJSON) : {};
        $scope.uiState = $scope.createChildUiState(getPersistedStateId($scope.panel), uiState);

        if ($scope.panel.type === savedVisualizations.type && $scope.savedObj.vis) {
          // kibi: allows restore the uiState after click edit visualization on dashboard
          const __panelid = sessionStorage.get('kibi_panel_id');
          if (__panelid) {
            if (__panelid.id === $scope.panel.id && __panelid.panel === getPersistedStateId($scope.panel) && __panelid.updated) {
              $scope.uiState.fromString(JSON.stringify(sessionStorage.get('kibi_ui_state')));
              sessionStorage.remove('kibi_panel_id');
              sessionStorage.remove('kibi_ui_state');
            }
          }
          // kibi: end

          $scope.savedObj.vis.setUiState($scope.uiState);
          $scope.savedObj.vis.listeners.click = $scope.getVisClickHandler();
          $scope.savedObj.vis.listeners.brush = $scope.getVisBrushHandler();
        } else if ($scope.panel.type === savedSearches.type) {
          // This causes changes to a saved search to be hidden, but also allows
          // the user to locally modify and save changes to a saved search only in a dashboard.
          // See https://github.com/elastic/kibana/issues/9523 for more details.
          $scope.panel.columns = $scope.panel.columns || $scope.savedObj.columns;
          $scope.panel.sort = $scope.panel.sort || $scope.savedObj.sort;

          $scope.setSortOrder = function setSortOrder(columnName, direction) {
            $scope.panel.sort = [columnName, direction];
            $scope.saveState();
          };

          $scope.addColumn = function addColumn(columnName) {
            $scope.savedObj.searchSource.get('index').popularizeField(columnName, 1);
            columnActions.addColumn($scope.panel.columns, columnName);
            $scope.saveState();  // sync to sharing url
          };

          $scope.removeColumn = function removeColumn(columnName) {
            $scope.savedObj.searchSource.get('index').popularizeField(columnName, 1);
            columnActions.removeColumn($scope.panel.columns, columnName);
            $scope.saveState();  // sync to sharing url
          };

          $scope.moveColumn = function moveColumn(columnName, newIndex) {
            columnActions.moveColumn($scope.panel.columns, columnName, newIndex);
            $scope.saveState();  // sync to sharing url
          };
        }

        $scope.filter = function (field, value, operator) {
          const index = $scope.savedObj.searchSource.get('index').id;
          filterManager.add(field, value, operator, index);
        };

        // kibi: toggle borders around panels
        $scope.border = !$scope.hideBorders;
        $scope.$watch('hideBorders', hideBorders => {
          if (hideBorders !== undefined) {
            $scope.border = !$scope.hideBorders;
          }
        });
        // kibi: end
      }

      $scope.loadedPanel = loadSavedObject(getObjectLoadersForDashboard(), $scope.panel)
        .then(initializePanel)
        .catch(function (e) {
          $scope.error = e.message;

          // Dashboard listens for this broadcast, once for every visualization (pendingVisCount).
          // We need to broadcast even in the event of an error or it'll never fetch the data for
          // other visualizations.
          $scope.$root.$broadcast('ready:vis');

          // If the savedObjectType matches the panel type, this means the object itself has been deleted,
          // so we shouldn't even have an edit link. If they don't match, it means something else is wrong
          // with the object (but the object still exists), so we link to the object editor instead.
          const objectItselfDeleted = e.savedObjectType === $scope.panel.type;
          if (objectItselfDeleted) return;

          const type = $scope.panel.type;
          const id = $scope.panel.id;
          const service = _.find(services, { type: type });
          if (!service) return;

          $scope.editUrl = '#management/kibana/objects/' + service.name + '/' + id + '?notFound=' + e.savedObjectType;
        });

      /**
       * @returns {boolean} True if the user can only view, not edit.
       */
      $scope.isViewOnlyMode = () => {
        return $scope.dashboardViewMode === DashboardViewMode.VIEW || $scope.isFullScreenMode;
      };
    }
  };
});