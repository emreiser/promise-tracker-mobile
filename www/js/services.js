angular.module('ptApp.services', [])

.factory('Survey', function($rootScope, $http, $ionicPopup, $state, $filter){
  localStorage['surveys'] = localStorage['surveys'] || '{}';
  localStorage['unsynced'] = localStorage['unsynced'] || '[]';
  localStorage['unsyncedImages'] = localStorage['unsyncedImages'] || '[]';
  localStorage['synced'] = localStorage['synced'] || '[]';

  var service = {
    baseUrl: 'http://dev.aggregate.promisetracker.org/',
    surveys: JSON.parse(localStorage['surveys']),
    unsynced: JSON.parse(localStorage['unsynced']),
    synced: JSON.parse(localStorage['synced']),
    unsyncedImages: JSON.parse(localStorage['unsyncedImages']),
    currentResponse: {},
    syncStatus: '',

    fetchSurvey: function(surveyCode, successCallback, errorCallback){
      var self = this;
      $http.get(this.baseUrl + 'surveys/' + surveyCode)
      .success(function(data){
        if(data.status == 'success'){
          successCallback(data);
        } else {
          errorCallback(data.error_code.toString());
        }
      })
      .error(errorCallback);
    },

    queueNewResponse: function(surveyId){
      this.currentResponse = {
        survey_id: surveyId,
        timestamp: '',
        inputs: JSON.parse(JSON.stringify(this.surveys[surveyId].inputs)),
        activeIndex: 0
      };
    },

    addToUnsynced: function(response){
      var index = this.unsynced.indexOf(response);
      if(index == -1){
        this.unsynced.push(response);
        localStorage['unsynced'] = JSON.stringify(this.unsynced);
      }
    },

    addResponseImageToUnsynced: function(response){
      var self = this;
      // Search for images in the survey response
      response.inputs.forEach(function(input){
        if(input.input_type == 'image' && input.answer){
          self.unsyncedImages.push({id: response.id, input_id: input.id, fileLocation: input.answer});
        }
      });
      self.syncImages();
    },

    removeImageFromUnsynced: function(image){
      var index = this.unsyncedImages.indexOf(image);
      if(index > -1){
        this.unsyncedImages.splice(index, 1);
        localStorage['unsyncedImages'] = JSON.stringify(this.unsyncedImages);
      }
    },

    addToSynced: function(response){
      var index = this.unsynced.indexOf(response);
      this.synced.push(response);
      localStorage['synced'] = JSON.stringify(this.synced)
      if(index > -1){
        this.unsynced.splice(index, 1);
        localStorage['unsynced'] = JSON.stringify(this.unsynced);
      }
    },

    formatResponse: function(response){
      var formattedResponse = {
        survey_id: response.survey_id,
        timestamp: response.timestamp,
        answers: []
      };

      response.inputs.forEach(function(input){
        var answer = { id: input.id, value: input.answer, input_type: input.input_type };

        if(input.input_type == 'select'){
          answer.value = input.answer.map(function(value, index){
            if(value){
              return input.options[index];
            }
          }).filter(function(n){ return n!= undefined; });
        }

        formattedResponse.answers.push(answer);
      })

      return formattedResponse;
    },

    syncResponse: function(response){
      var self = this;
      self.syncStatus = 'syncing';
      $rootScope.$broadcast('updatestatus');
      var formattedResponse = self.formatResponse(response);
      $http.post(
        this.baseUrl + 'responses', 
        { response: JSON.stringify(formattedResponse) }
      )
      .success(function(data){
        if(data['status'] == 'success'){
          response.id = data.payload.id;
          self.addToSynced(response);
          self.addResponseImageToUnsynced(response);
          self.syncStatus = 'synced';
          $rootScope.$broadcast('updatestatus');
        } else {
          console.log(data.error_message);
          self.syncStatus = 'unsynced';
          $rootScope.$broadcast('updatestatus');
        }
      })
      .error(function(response){
        self.addToUnsynced(response);
      });
    },

    syncImage: function(image){
      var self = this;
      self.syncStatus = 'syncing';
      $rootScope.$broadcast('updatestatus');
      // TODO: need to find if the image really exists
      // upload the image with cordova file-transfer
      var options = new FileUploadOptions();
      options.fileKey = "file";
      options.fileName = image.fileLocation.substr(image.fileLocation.lastIndexOf('/') + 1);
      options.mimeType = "image/jpeg";
      options.params = image;
      var fileTransfer = new FileTransfer();
      fileTransfer.upload(image.fileLocation, encodeURI(self.baseUrl + 'upload_image'), 
        function(){   // upload succeed
          self.removeImageFromUnsynced(image);
          self.syncStatus = 'synced';
          $rootScope.$broadcast('updatestatus');
        }, 
        function(error){   // upload failed
          // TODO: notify the frontend about image upload failure
          console.log(error);
          self.syncStatus = 'unsynced';
          $rootScope.$broadcast('updatestatus');
        }, options);
    },

    syncResponses: function(){
      var self = this;
      self.unsynced.forEach(function(response){
        self.syncResponse(response);
      })
    },

    syncImages: function(){
      var self = this;
      self.unsyncedImages.forEach(function(image){
        self.syncImage(image);
      })
    },

    cancelResponse: function() {
      var confirmPopup = $ionicPopup.confirm({
        template: $filter('translate')('DELETE_RESPONSE'),
        buttons: [
          {
            text: $filter('translate')('CANCEL')
          },
          {
            text: $filter('translate')('DELETE'),
            type: 'button-pink',
            onTap: function(){ return true; }
          }
        ]
      });
      confirmPopup.then(function(res) {
        if(res) {
          self.currentResponse = {};
          $state.go('home');
        }
      });
    }
  };

  return service;
})

.factory('User', function($rootScope){
  localStorage['user'] = localStorage['user'] || '{}';

  var service = {
    user: JSON.parse(localStorage['user']),

    updateInfo: function(){
      localStorage['user'] = JSON.stringify(this.user);
    }
  }

  return service;
});