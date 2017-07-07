import os
import json
import logging

from redash.query_runner import register
from redash.query_runner.pg import Redshift
from redash.utils import JSONEncoder

from ..utils import is_image_column, get_bucket_by_column_name, get_signed_s3_url


logger = logging.getLogger(__name__)


class CaptricityRedshift(Redshift):
    """
    Extends Redshift query runner with image rendering features.

    Specifically, if a column name has the right encoding (starts with <application>_image), then we will try to
    resolve the returned text as a S3 path to the <application> bucket.
    """
    # TODO (Yori): Figure out if there is a way to auto page so that we don't run out of memory when paging big data
    @classmethod
    def type(cls):
        return "capredshift"

    def run_query(self, *args, **kwargs):
        # TODO (Yori) Refactor redash run_query so that we can inject post processing in a better manner to avoid
        #             double json processing.
        # Execute query like normal, and if there is an error, pass through
        json_data, error = super(CaptricityRedshift, self).run_query(*args, **kwargs)
        if error is not None:
            return json_data, error

        # Introspect json_data to determine if there is a candidate for url encoding and encode it
        # Note: We have to reload the json data back to python dict for ease of use.
        data = json.loads(json_data)
        del json_data  # Memory saving
        image_columns = self._get_image_columns(data['columns'])
        image_columns_to_buckets = self._map_image_columns_to_buckets(image_columns)
        self._update_data_for_image_columns(image_columns_to_buckets, data)
        json_data = json.dumps(data, cls=JSONEncoder)
        return json_data, error

    @classmethod
    def _get_image_columns(cls, columns):
        return [c['name'] for c in columns if is_image_column(c['name'])]

    @classmethod
    def _map_image_columns_to_buckets(cls, image_columns):
        image_columns_to_buckets = {}
        for col in image_columns:
            bucket = get_bucket_by_column_name(col)
            if bucket is not None:
                image_columns_to_buckets[col] = bucket
        return image_columns_to_buckets

    @classmethod
    def _update_data_for_image_columns(cls, image_columns_to_buckets, data):
        # First update the column data type
        for col in data['columns']:
            if col['name'] in image_columns_to_buckets:
                col['type'] = 'image'

        # Then update the rows to be links to images
        for row in data['rows']:
            for col, bucket in image_columns_to_buckets.items():
                row[col] = get_signed_s3_url(bucket, os.path.join('media', row[col]))


register(CaptricityRedshift)
