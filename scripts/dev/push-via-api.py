#!/usr/bin/env python3
"""
网络受限时用 GitHub Git Data API 推送提交。

背景：本机代理有时只放通 api.github.com，挡住 github.com:443，导致 `git push` 报
      `CONNECT tunnel failed, response 502`。此脚本走 REST API，能绕开这个限制。

用法：
    python scripts/dev/push-via-api.py <token> [分支] [-m "提交信息"]

工作方式：
    1. 读远程分支当前提交的树；
    2. 与本地 HEAD 的树逐文件比对（只传有变化的文件）；
    3. 以远程树为基树建新树 → 建提交 → 更新分支引用。

注意：API 建出来的提交 sha 与本地不同（元数据不同），但树内容一致。
      等 github.com 恢复后，执行 `git fetch origin && git reset --hard origin/main`
      即可让本地与远程统一，历史不会丢内容。
"""
import base64
import json
import subprocess
import sys
import urllib.error
import urllib.request

OWNER = 'xxx1-sg'
REPO = 'Viridiore'
API = 'https://api.github.com'


def sh(*args):
    return subprocess.run(args, capture_output=True, text=True, check=True).stdout


def api(token, method, path, payload=None):
    data = json.dumps(payload).encode('utf-8') if payload is not None else None
    req = urllib.request.Request(API + path, data=data, method=method)
    req.add_header('Authorization', 'token ' + token)
    req.add_header('Accept', 'application/vnd.github+json')
    if data:
        req.add_header('Content-Type', 'application/json; charset=utf-8')
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            body = r.read()
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        print('!! HTTP', e.code, e.read().decode('utf-8', 'replace')[:400], file=sys.stderr)
        raise


def local_tree(head='HEAD'):
    """返回 {path: (mode, sha)}"""
    out = {}
    for line in sh('git', 'ls-tree', '-r', head).splitlines():
        meta, path = line.split('\t', 1)
        mode, _type, sha = meta.split()
        out[path] = (mode, sha)
    return out


def remote_tree(token, tree_sha):
    data = api(token, 'GET', f'/repos/{OWNER}/{REPO}/git/trees/{tree_sha}?recursive=1')
    out = {}
    for item in data.get('tree', []):
        if item['type'] == 'blob':
            out[item['path']] = (item['mode'], item['sha'])
    return out


def main():
    args = [a for a in sys.argv[1:]]
    if not args:
        print(__doc__)
        sys.exit(1)
    token = args.pop(0)
    message = None
    if '-m' in args:
        i = args.index('-m')
        message = args[i + 1]
        del args[i:i + 2]
    branch = args[0] if args else 'main'
    if not message:
        message = sh('git', 'log', '-1', '--pretty=%B').strip()

    ref = api(token, 'GET', f'/repos/{OWNER}/{REPO}/git/ref/heads/{branch}')
    remote_sha = ref['object']['sha']
    remote_commit = api(token, 'GET', f'/repos/{OWNER}/{REPO}/git/commits/{remote_sha}')
    base_tree = remote_commit['tree']['sha']
    remote = remote_tree(token, base_tree)
    local = local_tree()

    entries = []
    for path, (mode, sha) in local.items():
        if remote.get(path, (None, None))[1] == sha and remote.get(path, (None,))[0] == mode:
            continue
        raw = subprocess.run(['git', 'show', f'HEAD:{path}'], capture_output=True, check=True).stdout
        blob = api(token, 'POST', f'/repos/{OWNER}/{REPO}/git/blobs',
                   {'content': base64.b64encode(raw).decode('ascii'), 'encoding': 'base64'})
        entries.append({'path': path, 'mode': mode, 'type': 'blob', 'sha': blob['sha']})
        print('  +', path, len(raw), 'B')

    for path in remote:
        if path not in local:
            entries.append({'path': path, 'mode': '100644', 'type': 'blob', 'sha': None})
            print('  -', path)

    if not entries:
        print('远程内容已与本地一致，无需推送')
        return

    tree = api(token, 'POST', f'/repos/{OWNER}/{REPO}/git/trees',
               {'base_tree': base_tree, 'tree': entries})
    commit = api(token, 'POST', f'/repos/{OWNER}/{REPO}/git/commits',
                 {'message': message, 'tree': tree['sha'], 'parents': [remote_sha]})
    api(token, 'PATCH', f'/repos/{OWNER}/{REPO}/git/refs/heads/{branch}', {'sha': commit['sha']})
    print('已推送', commit['sha'], message.splitlines()[0])


if __name__ == '__main__':
    main()
