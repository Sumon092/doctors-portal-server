const express = require('express')
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express()
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.klqvs.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();
        // console.log('database connected');
        const treatmentCollection = client.db('doctors_portal').collection('treatments');
        const bookingCollection = client.db('doctors_portal').collection('bookings');

        app.get('/treatments', async (req, res) => {
            const query = {};
            const cursor = treatmentCollection.find(query);
            const treatments = await cursor.toArray();
            res.send(treatments);
        });

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
     * app.patch('/booking/:id) //
     * app.delete('/booking/:id) //
    */
        // app.get('/getAllBooking', async (req, res) => {
        //     const bookings = await bookingCollection.find({}).toArray();
        //     res.send(bookings)
        // })


        app.get('/booking', async (req, res) => {
            const patient = req.query.patient
            if (patient) {
                const query = { patient: patient }
                const bookings = await bookingCollection.find(query).toArray();
                res.send(bookings)
            }
            else {
                const query = { patient: patient }
                const bookings = await bookingCollection.find({}).toArray();
                res.send(bookings)

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