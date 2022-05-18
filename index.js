const express = require('express')
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express()
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.klqvs.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

const verifyJwt = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden Access' });
        }
        req.decoded = decoded;
        next();
    });
}

async function run() {
    try {
        await client.connect();
        // console.log('database connected');
        const treatmentCollection = client.db('doctors_portal').collection('treatments');
        const bookingCollection = client.db('doctors_portal').collection('bookings');
        const usersCollection = client.db('doctors_portal').collection('users');

        app.get('/treatments', async (req, res) => {
            const query = {};
            const cursor = treatmentCollection.find(query);
            const treatments = await cursor.toArray();
            res.send(treatments);
        });
        app.get('/user', verifyJwt, async (req, res) => {
            const users = await usersCollection.find().toArray();
            res.send(users);
        })

        app.put('/user/admin/:email', verifyJwt, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = {
                $set: { role: 'admin' },
            }
            const results = await usersCollection.updateOne(filter, updateDoc);
            res.send(results)
        })
        app.put('/user/:email', verifyJwt, async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true }
            const updateDoc = {
                $set: user,
            }
            const results = await usersCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ results, token })
        })

        // Warning: This is not the proper way to query multiple collection. 
        // After learning more about mongodb. use aggregate, lookup, pipeline, match, group
        app.get('/available', async (req, res) => {
            const searchByDate = req.query.date || 'May 16, 2022'

            // step 1:  get all services
            const services = await treatmentCollection.find().toArray();

            // step 2: get the booking of that day. output: [{}, {}, {}, {}, {}, {}]
            const query = { date: searchByDate };
            const bookings = await bookingCollection.find(query).toArray();
            //step:3 for each service
            services.forEach(service => {
                //step 4: find booking for this service
                const serviceBookings = bookings.filter(book => book.treatment === service.name);
                //step 5: select slots for the service bookings
                const bookedSlots = serviceBookings.map(book => book.slot);
                //step:6 select those slots that are in booked slots
                const available = service.slots.filter(slot => !bookedSlots.includes(slot));
                //set available slots to make it easier
                service.slots = available;
            })



            res.send(services);
        })

        /**
     * API Naming Convention
     * app.get('/booking') // get all bookings in this collection. or get more than one or by filter
     * app.get('/booking/:id') // get a specific booking 
     * app.post('/booking') // add a new booking
     * app.post('/booking/:id') upsert=> update (if exist) insert (if not exist)
     * app.patch('/booking/:id) //
     * app.delete('/booking/:id) //
    */
        // app.get('/getAllBooking', async (req, res) => {
        //     const bookings = await bookingCollection.find({}).toArray();
        //     res.send(bookings)
        // })


        app.get('/booking', verifyJwt, async (req, res) => {
            const patient = req.query.patient;
            // const authorization = req.headers.authorization;
            const decodedEmail = req.decoded.email;
            if (decodedEmail) {
                const query = { patient: patient }
                const bookings = await bookingCollection.find(query).toArray();
                return res.send(bookings);
            }
            else {
                return res.status(403).send({ message: 'Forbidden Access' });
            }

        });




        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
            const exists = await bookingCollection.findOne(query);
            if (exists) {
                return res.send({ success: false, booking: exists })
            }
            const result = await bookingCollection.insertOne(booking);
            return res.send({ success: true, result });
        })
    }
    finally {

    }

}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello from doctors portal!')
})

app.listen(port, () => {
    console.log(`Doctors portal listening on port ${port}`)
})