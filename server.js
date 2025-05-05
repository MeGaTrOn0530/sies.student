import express from "express"
import cors from "cors"
import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"
import fetch from "node-fetch" // Make sure to install this: npm install node-fetch

// Get current directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Initialize express app
const app = express()
const PORT = process.env.PORT || 3000
const BOT_SERVER_PORT = process.env.PORT2 || 3003 // Updated to match your bot server port

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, "../")))

// Data file paths
const STUDENTS_FILE = path.join(__dirname, "data", "students.json")

// Ensure data directory exists
async function ensureDataDir() {
  const dataDir = path.join(__dirname, "data")
  try {
    await fs.access(dataDir)
  } catch (error) {
    await fs.mkdir(dataDir, { recursive: true })
  }
}

// Initialize students data file if it doesn't exist
async function initDataFile() {
  try {
    await fs.access(STUDENTS_FILE)
  } catch (error) {
    await fs.writeFile(STUDENTS_FILE, JSON.stringify([]))
  }
}

// Read students data
async function readStudents() {
  try {
    const data = await fs.readFile(STUDENTS_FILE, "utf8")
    return JSON.parse(data)
  } catch (error) {
    console.error("Error reading students data:", error)
    return []
  }
}

// Write students data
async function writeStudents(students) {
  try {
    await fs.writeFile(STUDENTS_FILE, JSON.stringify(students, null, 2))
  } catch (error) {
    console.error("Error writing students data:", error)
  }
}
// Initialize data
;(async () => {
  await ensureDataDir()
  await initDataFile()
})()

// API Routes

// Get all students
app.get("/api/students", async (req, res) => {
  try {
    const students = await readStudents()
    res.json(students)
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch students" })
  }
})

// Get student by ID
app.get("/api/students/:id", async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id)
    const students = await readStudents()
    const student = students.find((s) => s.id === id)

    if (!student) {
      return res.status(404).json({ error: "Student not found" })
    }

    res.json(student)
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch student" })
  }
})

// Create new student
app.post("/api/students", async (req, res) => {
  try {
    const students = await readStudents()
    const newId = students.length > 0 ? Math.max(...students.map((s) => s.id)) + 1 : 1

    const newStudent = {
      id: newId,
      ...req.body,
    }

    students.push(newStudent)
    await writeStudents(students)

    res.status(201).json(newStudent)
  } catch (error) {
    res.status(500).json({ error: "Failed to create student" })
  }
})

// Update student
app.put("/api/students/:id", async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id)
    const students = await readStudents()
    const index = students.findIndex((s) => s.id === id)

    if (index === -1) {
      return res.status(404).json({ error: "Student not found" })
    }

    students[index] = { ...students[index], ...req.body }
    await writeStudents(students)

    res.json(students[index])
  } catch (error) {
    res.status(500).json({ error: "Failed to update student" })
  }
})

// Delete student
app.delete("/api/students/:id", async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id)
    let students = await readStudents()

    const initialLength = students.length
    students = students.filter((s) => s.id !== id)

    if (students.length === initialLength) {
      return res.status(404).json({ error: "Student not found" })
    }

    await writeStudents(students)

    res.json({ message: "Student deleted successfully" })
  } catch (error) {
    res.status(500).json({ error: "Failed to delete student" })
  }
})

// Authentication endpoint
app.post("/api/auth", async (req, res) => {
  try {
    const { login, password } = req.body
    const students = await readStudents()

    const student = students.find((s) => s.login === login && s.password === password)

    if (!student) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    // Return student info without password
    const { password: _, ...studentInfo } = student

    res.json({
      id: student.id,
      name: student.fullName.split(" ")[0],
      surname: student.fullName.split(" ").slice(1).join(" "),
      group: student.studentId,
      passport: student.studentId,
      phone: student.phone,
    })
  } catch (error) {
    res.status(500).json({ error: "Authentication failed" })
  }
})

// Ro'yxatdan o'tish API (Register)
app.post("/api/register", async (req, res) => {
  try {
    const { login, password, fullName, phone, studentId } = req.body
    const students = await readStudents()

    // Login band emasligini tekshirish
    if (students.some((s) => s.login === login)) {
      return res.status(400).json({ error: "Bu login allaqachon mavjud", success: false })
    }

    // Yangi ID yaratish
    const newId = students.length > 0 ? Math.max(...students.map((s) => s.id)) + 1 : 1

    // Yangi foydalanuvchi
    const newStudent = {
      id: newId,
      login,
      password,
      fullName,
      phone,
      studentId,
    }

    students.push(newStudent)
    await writeStudents(students)

    res.status(201).json({ message: "Ro'yxatdan muvaffaqiyatli o'tildi", success: true })
  } catch (error) {
    console.error("Registration error:", error)
    res.status(500).json({ error: "Foydalanuvchini qo'shishda xatolik yuz berdi", success: false })
  }
})

// Function to send verification code via the Telegram bot service
async function sendVerificationCodeViaTelegram(telegram) {
  try {
    console.log(`Sending verification code request to bot server for: ${telegram}`)
    const response = await fetch(`http://127.0.0.1:${BOT_SERVER_PORT}/send-verification-code`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ telegram }),
    })

    if (!response.ok) {
      console.error(`Bot server responded with status: ${response.status}`)
    }

    const data = await response.json()
    console.log(`Bot server response:`, data)
    return data
  } catch (error) {
    console.error("Error sending verification code via Telegram:", error)
    return { success: false, error: "Failed to send verification code" }
  }
}

// Function to verify code via the Telegram bot service
async function verifyCodeViaTelegram(telegram, code) {
  try {
    console.log(`Verifying code with bot server for ${telegram}: ${code}`)
    const response = await fetch(`http://localhost:${BOT_SERVER_PORT}/verify-code`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ telegram, code }),
    })

    if (!response.ok) {
      console.error(`Bot server responded with status: ${response.status}`)
    }

    const data = await response.json()
    console.log(`Bot server verification response:`, data)
    return data
  } catch (error) {
    console.error("Error verifying code via Telegram:", error)
    return { success: false, error: "Failed to verify code" }
  }
}

// Send verification code endpoint
app.post("/api/auth/send-verification-code", async (req, res) => {
  try {
    const { telegram } = req.body

    if (!telegram) {
      return res.status(400).json({ error: "Telegram username is required", success: false })
    }

    console.log(`Received request to send verification code to: ${telegram}`)

    // Send verification code via Telegram bot service
    const result = await sendVerificationCodeViaTelegram(telegram)

    if (result.success) {
      res.json({ success: true })
    } else {
      res.status(400).json({
        error: result.error || "Failed to send verification code",
        success: false,
      })
    }
  } catch (error) {
    console.error("Error sending verification code:", error)
    res.status(500).json({ error: "Failed to send verification code", success: false })
  }
})

// Verify code endpoint
app.post("/api/auth/verify-code", async (req, res) => {
  try {
    const { telegram, code } = req.body

    if (!telegram || !code) {
      return res.status(400).json({ error: "Telegram username and code are required", success: false })
    }

    console.log(`Verifying code for ${telegram}: ${code}`)

    // Verify code via Telegram bot service
    const result = await verifyCodeViaTelegram(telegram, code)

    if (result.success) {
      res.json({ success: true })
    } else {
      res.status(400).json({
        error: result.error || "Invalid verification code",
        success: false,
      })
    }
  } catch (error) {
    console.error("Error verifying code:", error)
    res.status(500).json({ error: "Failed to verify code", success: false })
  }
})

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Connecting to bot server on port ${BOT_SERVER_PORT}`)
})

