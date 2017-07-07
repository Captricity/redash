import boto3
import yaml

from .config import APPLICATION_BUCKET_MAP_YAML_PATH, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY


if APPLICATION_BUCKET_MAP_YAML_PATH is None:
    APPLICATION_BUCKET_MAP = {}
else:
    with open(APPLICATION_BUCKET_MAP_YAML_PATH) as yaml_file:
        APPLICATION_BUCKET_MAP = yaml.load(yaml_file)


def get_signed_s3_url(bucket, path, expires_in=300):
    """ Given bucket and path, generates a timed signed url to access the image in the s3 bucket. """
    s3 = boto3.client(
        's3',
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY)
    signed_url = s3.generate_presigned_url(
        'get_object',
        Params={
            'Bucket': bucket,
            'Key': path
        },
        ExpiresIn=expires_in)
    return signed_url


def is_image_column(column_name):
    """
    Given a column name from a redshift query, determines whether or not this is a image column.

    Based on heuristic that image columns are encoded as <application>_image, where <application> is one of the
    applications specified in the APPLICATION_BUCKET_MAP.

    Returns:
        True if the column_name is encoded to be retrieved as an image.
    """
    for application in APPLICATION_BUCKET_MAP:
        if column_name.startswith(application + '_image'):
            return True
    return False


def get_bucket_by_column_name(column_name):
    """
    Given a column name from a redshift query, determine what bucket the data potentially came from.

    Note: This uses a heuristic encoding based on convention, as opposed to hard data types.

    Returns:
        String representation of a bucket, or None if it can not be determined.
    """
    for application, bucket in APPLICATION_BUCKET_MAP.items():
        if column_name.startswith(application + '_image'):
            return bucket
    else:
        return None
