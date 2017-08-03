function CapsDatasets($http) {
  this.create = function create(name, contents) {
    const dataset = {
      name,
      script_name: name,
      script_type: 'sql',
      script_contents: contents,
    };
    return $http.post('/zenodot/api/v1/datasets', dataset);
  };
}

export default function (ngModule) {
  ngModule.service('CapsDatasets', CapsDatasets);
}
