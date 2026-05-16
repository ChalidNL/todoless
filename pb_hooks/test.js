console.log("TEST HOOK LOADED!")
routerAdd("GET", "/api/test-hook", (c) => {
    return c.json(200, {"message": "test hook works"})
})
