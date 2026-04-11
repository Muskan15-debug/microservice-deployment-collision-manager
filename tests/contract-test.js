const USER_SERVICE_URL = process.env.USER_SERVICE_URL || "http://localhost:5050";

async function runTest() {
    try {
        const res = await fetch(`${USER_SERVICE_URL}/user/1`);
        const data = await res.json();
        console.log("Received: ", data);
        if (!data.id || !data.name || !data.email) {
            console.error("Contract Broken!");
            process.exit(1);
        }

        console.log("Contract valid");
        process.exit(0);
    } catch (err) {
        console.error("User contract test failed", err.message);
        process.exit(1);
    }
}

runTest();