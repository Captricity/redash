import template from './dataset-create-modal.html';


function DatasetCreateModalController($scope) {
  this.title = this.resolve.title;
  $scope.name = this.resolve.name;
  this.confirm = () => {
    this.resolve.confirm.bind(this)($scope);
    this.close();
  };
}
DatasetCreateModalController.$inject = ['$scope'];

const DatasetCreateModalComponent = {
  template,
  bindings: {
    close: '&',
    dismiss: '&',
    resolve: '<',
  },
  controller: DatasetCreateModalController,
};

export default function (ngModule) {
  ngModule.component('datasetCreateModal', DatasetCreateModalComponent);
}
