const express = require("express")

const app = express()

const PORT = 5050

app.use((req,res)=>{
  console.log("Server is running")
})

app.listen((PORT))
