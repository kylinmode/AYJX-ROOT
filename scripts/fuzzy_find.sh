#!/system/bin/sh
# ==========================================================
#  fuzzy_find.sh
#
#  本文件由 build.py 加密生成，里面的逻辑不可直接阅读。
#  想改功能请改 src/scripts/fuzzy_find.sh 后重新构建，直接改这里会破坏校验。
# ==========================================================
if command -v base64 >/dev/null 2>&1; then
    _b64d() { base64 -d 2>/dev/null; }
else
    _b64d() { busybox base64 -d 2>/dev/null; }
fi

_d=$(sed -n '/^__BLOB__$/,$p' "$0" 2>/dev/null | sed '1d' | tr -d '\r\n')
[ -n "$_d" ] || { printf '%s\n' "❌ 脚本数据为空（文件被截断？）" >&2; exit 1; }

_i=0
while [ "$_i" -lt 3 ]; do
    _d=$(printf '%s' "$_d" | tr '6/ED9KZiHmrkgqdBzfU3+astb7lWnVNQGhcTpX4SOPxMjCeIJwFu2L8o5y01AYRv' 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/' | _b64d)
    _i=$((_i + 1))
done

case "$_d" in
    '#'*|' '*|'') : ;;
    *) printf '%s\n' "❌ 解密结果异常，脚本可能被改动过" >&2; exit 1 ;;
esac
[ -n "$_d" ] || { printf '%s\n' "❌ 解密失败" >&2; exit 1; }

eval "$_d"
_rc=$?
# 必须 exit，否则 sh 会继续把下面的密文当命令逐行执行
exit "$_rc"

__BLOB__
a3XcNaauN+XulsKunufkfZwLl9gMUL7+nofhlSKJsUCadtPZnFCHVsVbs9aSVs2oNXfSfSgMUiaS
sKhK7oaCqoP+727ur2hL7LhbfsVLW3V0aZVZnFCHVsVbs9aSVs2oNXfSfSgMUiaSsKhK7oaCqoP+
727ur2hL7LhbfsVLW3V0aZVZnFCHVsV3W+h4niOF34XC+Ej532Jug8bu78X0g4mgWSVarLhDg8KO
g8yb7TqwfD7onuXJWL7kk2YwVEjFb3XOg8HFapqsbshwn+wkguq2WtzMdaX2g8KOsDqIq8mjf9Cw
r2w4ns7lnsXtnLXcbaPDgFCllZqtVs7cg2wkUTnuUofulUYH7LqCUKaJsUCas47hrufwaUCJd3Ho
ViKMWKhHgSHF3KhcgXGMbaa73Dq37Xq4WLhq7TfoNtKg+DVdn2q+NTmO+Zy2sZapl3XZb3h4niKJ
aTmeVKhXauGob495UuVhU85L3Tq03i9Mr2XjVsG2W9joWZzMsZat3ZhgbahzliO5z2XcVECIaXPg
3Kal74KdnoKagLqssEj2NTh4gX7Eb3XOnZ557TgMqZVynaPhlXVJ3i/ts4Lw7XzoWunFb3XusX/T
a3Xsbo9yz2wwVtKT7o/OU8wJW4YsfK7Bb3mhdUCL7pmS3Zh+3TX4bTgubtfud+KoNS/bWaak74mj
dapFnuXgnUCgl9Yh3K7cg898Voql+9LjgoOFWXgoUTnMlZ2MUoKxWDm7W+yhn+OobUYCaUCbUEjF
sZLada/Za3pod3gFsipM3EYBntzMgSqlzuqwsSKD7pf0gXa9d3mudaX4aUCbUKbu74HubtKraUCg
dECLNSVSVsbM34X4gFjFlZLulUYEaTq4b4wgnUC4g4hHWS/OnTqg7pGod3aq3XP4lX7hfo+ug4yI
ruGyUTqbnsHMg85FnLOMW872s9wtdUj5NSfbN3VubtXhVshONTfSdiP2sZqeWFCrn+whsZVPWaae
r8LPg2w4UZ79W3V0aZVZnFCHVsVbs9aSVs2oNXfSfSgMUiaSsKhK7oaCqoP+727ur2hL7LhbfsVL
W3V0aZVZnFCHVsVbs9aSVs2oNXfSfSgMUiaSsKhK7oaCqoP+727ur2hL7LhbfsVLW3V0aZVZWTfc
Ntqkb+ahr8hrgLgMNsVlz8KdbahH7pJIg952UufFdDVOaoq4fs9Ml9OodiKHWS6MgSq97phadK/P
WZY4z4bFlKzo+L6JbSqc33n2U2godsh+l2JonZ7Tz+7tUL/OqFChaiKJaph4aaXcbXfO3L+Ml9Cj
di9ubS/zlsV9a4KwVUYZro/bnZHF74mjUL7Kr2COf4nMstKwnLXrqFCOU3gFWSVtWFYbWDmgg2yk
aSKarLhH7iqwU8mLq8XadUCmnuXyWiq9W+h4fKhZnta4U4yJrumufZ7Ha3hzlaakruh0Va7kn3fw
z8fuq2qFdiKH74Y0VswJaSquqZhcb3msz4bFl9CwnZyIW4Ykz49FbThcVsK07KPsUDV9NpLwdtX+
aUCg3DgFaSXdn8Kb34Keqsm2s9LcW2Cya2fOb25uaXOudZ7+nagIqZfhlZKada7E7TmOUoKJW4Ys
s4h0bt6MdKbFrumw3EYk7pJ8gXVPntXedshkaspIqZfhlZKas4n5NpJo+igy38Yha+9Fa3X4UEj2
lT+osZhubpwbsZK3nsYjnZhzat/sbL7kqoKadsKS7DXO+Zj5liq4fZL+aFCxUsj5U8jonZPqWpfh
aK+ybsaenZhknt/sUZfu3ZjoaZLcquXO+ZwJa4aunZPZa3X0f47gq8wunL/2a2JobXn2n+YaqZ2F
3XGInZ7TsthwW8Vg7TmCbsj538YeWLGubahzl3g5NswaVsLZ7uhzlsm+lDnuULbu3S/sfs9uqoma
sS/ZWS/OUoKJaphjnL/Za3pMdZbFl9CwnK7H7Xa7sK+yNp74diXmluhzlX7P+9mtroO5Wi/OWZfu
+9h4r8hCaaPwU4nMlK6oqZhXn+job4KJruhur8hzqo/bViqbs9XwW87HguhCliO5b3mhVEYZa3pM
dZbFl9CwnK7H7Xa7fZm37TfhsSVjbSzIUZ79WspoVtK57ThyWiq2b+h4fZLPq8Yzz4bFl9CwnK7H
7Tgolaak38YanoX+nt/7l49uquVadtPy7FCOWZ5yapa4fZLPb+wzlDVu7XPM3EYZ7TfzNXalsihe
nZhknt/sUZbuq8XadUj57TmOUoKJa4qpda7PNXGMUa7hqoatVZKuWECOzXVb+ZCSq9qkl2JI3sbu
q8Ye+L/E7TmOUoKJaph4guVPa3pMdZbFl9CMVs72auhksi9Fruhur8hjnLOMWog2d+weqKhogLPC
g85uWsacd9VZbXq4zFCLaTmdqK/HWKa7WaVJq2PjnZhjWcC7fpyJssXadUj57TmOUoKJaph4guVP
a3pMUUC9aXfwn9KIn+Cb78KL7T/4gphL7o/s+872k8punZmmNThCgTVb74Puq9Cra3X0f4b5aTXj
nK7Truhgb4m3nth439jJgumsUZbuq8XadUj57TmOUoKJaph4aaXFb3h7+8bFWsKMgX/2auhslsyJ
bpXwUL7mbSgMWoKJssXadUj57TmOUoKJaphjg8LZa3pMdZbFl9CwnK7H7Xa7NS957uGu3K7LataC
b8fllZmwg4Kr7Tmys4Cg7Sftd9Cbbt/hNDqu7XPMgX/Xn+COsZKJr2Xur8K+nt/sUZ7as3V4n8n5
7TmOU8jFlSaela/Pgo/zz4bFl9CwnK7H7Tgolaak+ZmwdshkW9C4VKn5ULhhnEj5nFCCbtKJ+97h
aaXFaLf4bTVhq8wcnK7Hqoqo7+ylbsPtrLhbWTmONDVPnagoru+Fa+w47Dg2V2AosSVugumy7Z9F
3ZmsdZKHbS+oaa+yb+hagL7jbTqO3aVId+7w3K/O7TfyaKaPW+h4guVPa3pMdZbFl9CM3Zh2Wifk
bXaln9X4qiVL3TqHW8mLqLfsU2YonLPOVZJu7XfhV+CcbThxdZb53iadnK7yr2fO32yuWaPdgFYT
W4YkgSq+bafjgcCmb+CsUsmubtq4guVaa3XhUK+ua4wcg8hqa8AyfSKg+Zh4qiX+asXCUZbuq8Xa
sS/ZWTfgnTqLgT2=
