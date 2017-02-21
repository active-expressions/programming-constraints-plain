var a = 3,
    c = 4,
    nonCVar = 15;
var proxyB = 0;

{
    let b = 2
    always: a == 2 * b;
    b = 17;
    proxyB = b;
}
a = 17 + nonCVar;

{
    always: 2 * a + 1 == c;
    a += 42;
    nonCVar = 1;
}

[a,proxyB, c];