const express = require('express');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8000;
const USER_SERVICE_URL = process.env.USER_SERVICE_URL;

app.get('/order/:id', async (req, res) => {
    try {
        const id = req.params.id;
        
        // Fetch data from the user service
        const response = await fetch(`${USER_SERVICE_URL}/user/${id}`);
        
        if (!response.ok) {
            return res.status(response.status).json({ error: 'Failed to fetch user data from User Service' });
        }

        const userData = await response.json();

        // Validate the structure of the data
        if (!userData.id || !userData.name || !userData.email) {
            return res.status(400).json({ 
                error: 'Invalid user data received. Must contain id, name, and email.',
                receivedData: userData 
            });
        }

        // Send back a success response
        res.status(200).json({
            message: 'Order processed successfully using valid user data',
            orderId: `ORD-${id}`,
            userDetails: {
                id: userData.id,
                name: userData.name,
                email: userData.email
            }
        });

    } catch (error) {
        console.error('Error fetching user data:', error.message);
        res.status(500).json({ error: 'Internal server error while communicating with User Service' });
    }
});

app.listen(PORT, () => {
    console.log(`Order Service is listening on port ${PORT}`);
});
