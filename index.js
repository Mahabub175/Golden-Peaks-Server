const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const morgan = require("morgan");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);

const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());
// app.use(morgan("dev"));

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  // bearer token
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ig2b4pm.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const classesCollection = client.db("goldenPeaks").collection("allClass");
    const instructorCollection = client
      .db("goldenPeaks")
      .collection("instructors");
    const addedClassCollection = client
      .db("goldenPeaks")
      .collection("addedClass");
    const usersCollection = client.db("goldenPeaks").collection("users");
    const paymentCollection = client.db("goldenPeaks").collection("payments");

    // jwt api

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "7d",
      });

      res.send({ token });
    });

    // verify Admin

    // const verifyAdmin = async (req, res, next) => {
    //   const email = req.body.email;
    //   const query = { email: email };
    //   const result = await usersCollection.findOne(query);
    //   if (result?.role !== "admin") {
    //     return res
    //       .status(403)
    //       .send({ error: true, message: "Forbidden access" });
    //   }
    //   next();
    // };

    // // verify Instructor

    // const verifyInstructor = async (req, res, next) => {
    //   const email = req.decoded.email;
    //   const query = { email: email };
    //   const result = await usersCollection.findOne(query);
    //   if (result?.role !== "instructor") {
    //     return res
    //       .status(403)
    //       .send({ error: true, message: "Forbidden access" });
    //   }
    //   next();
    // };

    // users api

    app.post("/users", async (req, res) => {
      const user = req.body;
      const email = user.email;

      const existUser = await usersCollection.findOne({ email: email });
      if (existUser) {
        return res.json("User Exist");
      } else {
        const result = await usersCollection.insertOne(user);
        res.send(result);
      }
    });

    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // admin api

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const userUpdate = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, userUpdate);
      res.send(result);
    });

    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      // if (req.decoded.email !== email) {
      //   res.send({ admin: false });
      // }
      const query = { email: email };
      const user = await usersCollection.findOne(query);

      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    app.patch("/popular-classes/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const newData = req.body;
      const updateDoc = {
        $set: {
          status: newData.status,
          feedback: newData.feedback || "No Feedback!",
        },
      };
      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // instructors api

    app.patch("/users/instructor/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const userUpdate = {
        $set: {
          role: "instructor",
        },
      };
      const result = await usersCollection.updateOne(filter, userUpdate);
      res.send(result);
    });

    app.get("/users/instructor/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);

      const result = { instructor: user?.role === "instructor" };
      res.send(result);
    });

    app.get("/instructor-classes", async (req, res) => {
      const email = req.query.email;
      const query = { instructor_email: email };
      const result = await classesCollection.find(query).toArray();
      res.send(result);
    });

    // classes api

    app.get("/popular-classes", async (req, res) => {
      const result = await classesCollection
        .find()
        .sort({ number_of_students: -1 })
        .toArray();
      res.send(result);
    });

    app.post("/popular-classes", async (req, res) => {
      const classes = req.body;
      const result = await classesCollection.insertOne(classes);
      res.send(result);
    });

    app.put("/popular-classes/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const newData = req.body;
      const updateDoc = {
        $set: {
          name: newData.instructorName,
          email: newData.instructorEmail,
          image: newData.image,
          class_name: newData.className,
          available_seats: newData.availableSeats,
          number_of_students: newData.numberOfStudents,
          price: newData.price,
          status: newData.status,
        },
      };
      const result = await classesCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });

    // instructor api

    app.get("/popular-instructors", async (req, res) => {
      const result = await instructorCollection
        .find()
        .sort({ number_of_students: -1 })
        .toArray();
      res.send(result);
    });

    // selected class api

    app.post("/selected-classes-cart", async (req, res) => {
      const classes = req.body;
      const result = await addedClassCollection.insertOne(classes);
      res.send(result);
    });

    app.get("/selected-classes-cart", async (req, res) => {
      // const decodedEmail = req.decoded.email;
      const email = req.query.email;
      const query = { email: email };
      // if (email !== decodedEmail) {
      //   return res
      //     .status(403)
      //     .send({ error: true, message: "forbidden access" });
      // }
      const result = await addedClassCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/selected-classes-cart/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await addedClassCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/enrollDetails", async (req, res) => {
      const email = req.query.email;
      const user = await paymentCollection.find({ email: email }).toArray();
      if (user) {
        const payments = await paymentCollection
          .find({ email: email })
          .toArray();
        const classIds = payments.flatMap((payment) => payment.classId);
        const filteredClassIds = classIds.filter(
          (classId) => classId !== null && classId !== undefined
        );
        const classes = await classesCollection
          .aggregate([
            {
              $match: {
                _id: { $in: filteredClassIds.map((id) => new ObjectId(id)) },
              },
            },
            {
              $project: {
                _id: 1,
                class_name: 1,
                class_image: 1,
                instructor_name: 1,
                instructor_email: 1,
              },
            },
          ])
          .toArray();
        res.send(classes);
      } else {
        return res.send([]);
      }
    });

    // payment api

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseFloat(price) * 100;
      if (!price) return;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payment", async (req, res) => {
      try {
        const data = req.body;
        const classId = data.classId;
        const result = await paymentCollection.insertOne(data);

        const filter = { _id: new ObjectId(classId) };
        const update = [
          {
            $set: {
              available_seats: { $toInt: "$available_seats" },
              number_of_students: { $toInt: "$number_of_students" },
            },
          },
        ];
        await classesCollection.updateOne(filter, update);

        const deletedRes = await addedClassCollection.deleteOne({
          _id: new ObjectId(data.classId),
        });

        res.send({ result, deletedRes });
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .send({ error: "An error occurred while processing the payment." });
      }
    });

    app.get("/payment", async (req, res) => {
      const email = req.query.email;
      const result = await paymentCollection
        .find({ email: email })
        .sort({ date: -1 })
        .toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Golden Peaks Server is running..");
});

app.listen(port, () => {
  console.log(`Golden Peaks is running on port ${port}`);
});
