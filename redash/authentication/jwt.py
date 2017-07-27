from __future__ import absolute_import

import requests
from redash import models
from redash.authentication.org_resolving import current_org


def get_user_info_from_authorization(authorization):
    from redash_captricity_customizations import config
    # Retrieve the user info using the authorization token
    response = requests.get(
        config.USER_SERVICE_URL,
        headers={
            'Authorization': authorization,
            'Content-Type': 'application/json'
        })
    if response.status_code != requests.codes.ok:
        return None

    user_info = response.json()
    return user_info


def authorize_user(user_info):
    if user_info is None:
        return None

    email = user_info['email']
    name = user_info['first_name'] + ' ' + user_info['last_name']
    user = models.User.query.filter_by(email=email).first()
    if user:
        return user
    else:
        # Create user
        group_ids = [current_org.default_group.id]
        if user_info['is_staff']:
            group_ids.append(current_org.admin_group.id)
        user = models.User(
            org=current_org,
            name=name,
            email=email,
            group_ids=group_ids)
        models.db.session.add(user)
        models.db.session.commit()
        return user

    return None


def load_user_from_jwt(request):
    jwt = request.args.get('jwt', None)
    if jwt is not None:
        authorization = 'Bearer ' + jwt
    else:
        authorization = request.headers.get('Authorization', '')
    user_info = get_user_info_from_authorization(authorization)
    return authorize_user(user_info)
