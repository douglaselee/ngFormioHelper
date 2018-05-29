angular.module('ngFormBuilderHelper')
.constant('FormController', [
  '$scope',
  '$stateParams',
  '$state',
  'Formio',
  'FormioHelperConfig',
  'FormioAlerts',
  function (
    $scope,
    $stateParams,
    $state,
    Formio,
    FormioHelperConfig,
    FormioAlerts
  ) {
    $scope.loading = true;
    $scope.hideComponents = [];
    $scope.submission = {data: {}};
    $scope.formId = $stateParams.formId;
    $scope.formUrl = FormioHelperConfig.appUrl + '/form';
    $scope.appUrl = FormioHelperConfig.appUrl;
    var formTag = FormioHelperConfig.tag || 'common';
    $scope.formUrl += $stateParams.formId ? ('/' + $stateParams.formId) : '';
    $scope.form = {
      display: 'form',
      components:[],
      type: ($stateParams.formType ? $stateParams.formType : 'form'),
      tags: [formTag]
    };
    $scope.tags = [{text: formTag}];
    $scope.formio = new Formio($scope.formUrl);
    $scope.formDisplays = [
      {
        name: 'form',
        title: 'Form'
      },
      {
        name: 'wizard',
        title: 'Wizard'
      }
    ];

    // Load the form if the id is provided.
    if ($stateParams.formId) {
      $scope.formLoadPromise = $scope.formio.loadForm(null, {ignoreCache: true}).then(function(form) {
        form.display = form.display || 'form';
        $scope.form = form;
        var tags = form.tags || [];
        $scope.tags = tags.map(function(tag) { return {text: tag}; });
        return form;
      }, FormioAlerts.onError.bind(FormioAlerts));
    }
    else {
      // Load the roles available.
      if (!$scope.form.submissionAccess) {
        Formio.makeStaticRequest(Formio.getProjectUrl() + '/role?limit=1000').then(function(roles) {
          if ($scope.form.submissionAccess) {
            return;
          }
          angular.forEach(roles, function(role) {
            if (!role.admin && !role.default && role.title === 'Authenticated') {
              // Add access to the form being created to allow for authenticated people to create their own.
              $scope.form.submissionAccess = [
                {
                  type: 'create_own',
                  roles: [role._id]
                },
                {
                  type: 'read_own',
                  roles: [role._id]
                },
              //{
              //  type: 'update_own',
              //  roles: [role._id]
              //},
                {
                  type: 'delete_own',
                  roles: [role._id]
                }
              ];
            }
          });
        });
      }
    }

    // Match name of form to title if not customized.
    $scope.titleChange = function(oldTitle) {
      $scope.formDirty = true;
      if (!$scope.form.name || $scope.form.name === _.camelCase(oldTitle)) {
        $scope.form.name = _.camelCase($scope.form.title);
        $scope.form.path = $scope.form.name.toLowerCase();
      }
      if ($scope.$parent && $scope.$parent.form) {
        $scope.$parent.form.title = $scope.form.title;
      }
    };

    // Update form tags
    $scope.updateFormTags = function() {
      $scope.formDirty = true;
      $scope.form.tags = $scope.tags.map(function(tag) { return tag.text; });
    };

    // When name is updated
    $scope.$watch('form.name', function (name, previous) {
      if (name !== previous && previous) {
        $scope.formDirty = true;
      }
    });

    // When path is updated
    $scope.$watch('form.path', function (path, previous) {
      if (path !== previous && previous) {
        $scope.formDirty = true;
      }
    });

    // When display is updated
    $scope.$watch('form.display', function (display, previous) {
    // Don't set dirty here, controller shared by form.abstract route!
    //if (display !== previous) {
    //  $scope.formDirty = true;
    //}
      $scope.$broadcast('formDisplay', display);
    });

    // When display is updated in editor
    $scope.displayChange = function() {
      $scope.formDirty = true;
    };

    // When a submission is made.
    $scope.$on('formSubmission', function(event, submission) {
      FormioAlerts.addAlert({
        type: 'success',
        message: 'New submission added!'
      });
      if (submission._id) {
        $state.go($scope.basePath + 'form.submission.view', {subId: submission._id});
      }
    });

    $scope.$on('pagination:error', function() {
      $scope.loading = false;
    });
    $scope.$on('pagination:loadPage', function() {
      $scope.loading = false;
    });

    $scope.$root.$on('$stateChangeStart', function (event, toState, toParams) {
      if ($scope.formDirty) {
        // Clear any alerts
        FormioAlerts.getAlerts();
        FormioAlerts.addAlert({
          type: 'danger',
          message: 'Save or Cancel changes.'
        });
        event.preventDefault();
      }
    });

    // Called when the form is updated.
    $scope.$on('formUpdate', function(event, form) {
      $scope.formDirty = true;
      $scope.form.components = form.components;
    });

    $scope.$on('formError', function(event, error) {
      FormioAlerts.onError(error);
    });

    // Called when the form or resource is deleted.
    $scope.$on('delete', function() {
      var type = $scope.form.type === 'form' ? 'Form ' : 'Resource ';
      FormioAlerts.addAlert({
        type: 'success',
        message: type + $scope.form.name + ' was deleted.'
      });
      $state.go($scope.basePath + 'home');
    });

    $scope.$on('cancel', function() {
      // Clear any alerts
      FormioAlerts.getAlerts();
      $scope.formDirty = false;
      // Where to go when cancelling update.
      if ($scope.formId) {
        $state.go($scope.basePath + 'form.view');
      }
      // Where to go when cancelling create.
      else {
        $state.go($scope.basePath + 'home');
      }
    });

    $scope.$on('saveForm', function(event) {
      // Stop propagation or another instance of FormController
      // will do the same thing and PUT errors may occur
      event.stopPropagation();
      $scope.saveForm();
      $scope.formDirty = $scope.$parent.formDirty = false;
    });

    // Save a form.
    $scope.saveForm = function() {
      // Clear any previous alerts
      FormioAlerts.getAlerts();

      $scope.formio.saveForm(angular.copy($scope.form)).then(function(form) {
        angular.merge($scope.form, form);
        var method = $stateParams.formId ? 'updated' : 'created';
        FormioAlerts.addAlert({
          type: 'success',
          message: 'Successfully ' + method + ' form!'
        });
        if (method === 'created')
          $state.go($scope.basePath + 'form.view', {formId: form._id});
      }, FormioAlerts.onError.bind(FormioAlerts));
    };
  }
]);
