"""Read-only deployment checks. Never creates accounts, bookings or payments."""
import argparse
import json
import re
import urllib.error
import urllib.request


def fetch(url, headers=None, method='GET'):
    request = urllib.request.Request(url, headers={'Cache-Control':'no-cache', **(headers or {})}, method=method)
    try:
        response = urllib.request.urlopen(request, timeout=30)
    except urllib.error.HTTPError as exc:
        response = exc
    with response:
        return response.status, response.read(), response.headers


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--backend', default='https://gharsathi-a9er.onrender.com')
    parser.add_argument('--frontend', default='https://bookgharsathi.in')
    parser.add_argument('--expected-commit', required=True, help='Full 40-character reviewed main commit')
    args = parser.parse_args()
    if not re.fullmatch(r'[a-f0-9]{40}',args.expected_commit):
        parser.error('--expected-commit must be a full lowercase Git SHA')
    checks=[]
    def check(name, passed):
        checks.append({'name':name,'result':'PASS' if passed else 'FAIL'})
    backend=args.backend.rstrip('/')
    frontend=args.frontend.rstrip('/')
    try:
        status, body, _ = fetch(backend+'/')
        health=json.loads(body)
        check('backend_database_health',status==200 and health.get('database')=='connected')
        check('backend_commit',health.get('commit')==args.expected_commit)
        status, body, _ = fetch(frontend+'/build-info.json')
        info=json.loads(body)
        check('frontend_commit',status==200 and info.get('commit')==args.expected_commit and info.get('dirty') is False)
        status, body, _ = fetch(backend+'/api/services/')
        check('catalogue',status==200 and isinstance(json.loads(body),list) and bool(json.loads(body)))
        for resource in ['bookings','customers','technicians']:
            status, _, _ = fetch(f'{backend}/api/{resource}/')
            check(f'anonymous_{resource}_denied',status in (401,403))
        status, _, headers=fetch(backend+'/api/bookings/',{
            'Origin':frontend,'Access-Control-Request-Method':'POST',
            'Access-Control-Request-Headers':'authorization,content-type'},method='OPTIONS')
        check('frontend_cors',status in (200,204) and headers.get('Access-Control-Allow-Origin')==frontend)
        status, html, _=fetch(frontend+'/')
        scripts=re.findall(r'<script[^>]+src="(/assets/[^\"]+\.js)"',html.decode())
        check('frontend_entry',status==200 and bool(scripts))
        for asset in scripts:
            status, body, _=fetch(frontend+asset)
            check('payment_failure_not_simulated',status==200 and b'Payment simulated successfully in browser demo mode.' not in body)
    except (ValueError, OSError) as exc:
        checks.append({'name':'deployment_response','result':'FAIL','error_type':type(exc).__name__})
    print(json.dumps({'expected_commit':args.expected_commit,'checks':checks,
                      'scope':'Read-only deployment checks; no gateway transaction or booking executed.'},indent=2))
    return 0 if checks and all(c['result']=='PASS' for c in checks) else 1


if __name__=='__main__':
    raise SystemExit(main())
