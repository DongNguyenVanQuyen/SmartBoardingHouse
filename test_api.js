const axios = require('axios');

async function testAPI() {
    try {
        console.log("Attempting login...");
        const loginRes = await axios.post('http://localhost:8080/api/auth/login', {
            email: 'dnvq291104@gmail.com',
            password: '123456'
        });
        
        console.log("Login successful!");
        const token = loginRes.data.data.accessToken || loginRes.data.token || loginRes.data.accessToken;
        
        if (!token) {
            console.log("No token found in response:", loginRes.data);
            return;
        }

        const headers = { Authorization: `Bearer ${token}` };
        const base_url = 'http://localhost:8080/api';

        const endpoints = [
            { name: 'Meter Readings (History, Electric)', method: 'get', url: `${base_url}/meter-readings/history?type=electric` },
            { name: 'Meter Readings (Rooms)', method: 'get', url: `${base_url}/meter-readings/rooms` },
            { name: 'Meter Readings (Previous, Electric)', method: 'get', url: `${base_url}/meter-readings/previous?type=electric` },
            { name: 'Messages (Me)', method: 'get', url: `${base_url}/messages/me` },
            { name: 'Profile', method: 'get', url: `${base_url}/profile` },
            { name: 'Rooms Current', method: 'get', url: `${base_url}/rooms/current` },
            { name: 'Contracts', method: 'get', url: `${base_url}/contracts` },
            { name: 'Invoices', method: 'get', url: `${base_url}/invoices` },
            { name: 'Maintenance Requests', method: 'get', url: `${base_url}/maintenance-requests` },
            { name: 'Notifications', method: 'get', url: `${base_url}/notifications` },
            { name: 'Dashboard (if exists)', method: 'get', url: `${base_url}/dashboard` },
        ];

        let results = [];

        for (const ep of endpoints) {
            try {
                let res = await axios.get(ep.url, { headers });
                
                const hasData = res.data && res.data.data && Object.keys(res.data.data).length > 0;
                results.push({ 
                    endpoint: ep.name, 
                    url: ep.url, 
                    status: 'Success', 
                    hasData: hasData ? 'Yes' : 'No/Empty' 
                });
            } catch (e) {
                const errMsg = e.response && e.response.data ? (e.response.data.message || e.response.data) : e.message;
                results.push({ 
                    endpoint: ep.name, 
                    url: ep.url, 
                    status: 'Error', 
                    message: errMsg 
                });
            }
        }
        
        console.table(results);

    } catch (error) {
        console.error("API Test Failed:", error.response ? error.response.data : error.message);
    }
}

testAPI();
