from __future__ import absolute_import

import jwt
from redash import models
from redash.authentication.org_resolving import current_org


def parse_authorization(authorization):
    try:
        bearer_kwd, raw_jwt_token = authorization.split(' ')
    except ValueError:
        return None

    if bearer_kwd != 'Bearer':
        return None

    # TODO (Yori) Maybe we should verify the token one more time?
    jwt_token = jwt.decode(raw_jwt_token, verify=False)  # NOTE: No need to verify because it is verified by Kong
    email = jwt_token['email']
    name = jwt_token['name']
    user = models.User.query.filter_by(email=email).first()
    if user:
        return user
    else:
        # Create user
        user = models.User(
            org=current_org,
            name=name,
            email=email,
            group_ids=[current_org.default_group.id])
        models.db.session.add(user)
        models.db.session.commit()
        return user

    return None


def load_user_from_jwt(request):
    return parse_authorization(request.headers.get('Authorization', ''))
