const express = require("express");

const router = express.Router();
const auth = require("../middlewares/auth");
const Task = require("../models/Task");

router.get("/test", auth, (req, res) => {
  res.json({
    message: "Task routes are working!",
    user: req.user,
  });
});

// CRUD tasks for authenticated users

//create a task
router.post("/", auth, async (req, res) => {
  try {
    // description, completed from req.body
    // owner : req.user._id
    const task = new Task({
      ...req.body,
      owner: req.user._id,
    });
    await task.save();
    res.status(201).json({ task, message: "Task Created Successfully" });
  } catch (err) {
    res.status(400).send({ error: err });
  }
});

// get user tasks
// router.get("/", auth, async (req, res) => {
//   try {
//     const tasks = await Task.find({
//       owner: req.user._id,
//     });
//     res.status(200).json({
//       tasks,
//       count: tasks.length,
//       message: "Tasks Fetched Successfully",
//     });
//   } catch (err) {
//     res.status(500).send({ error: err });
//   }
// });
router.get("/", auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;

    const tasks = await Task.find({
      owner: req.user._id,
    })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .exec();

    const totalCount = await Task.countDocuments({ owner: req.user._id });

    res.status(200).json({
      tasks,
      count: tasks.length,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
      currentPage: page,
      message: "Tasks Fetched Successfully",
    });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

//fetch a task by id

router.get("/:id", auth, async (req, res) => {
  const taskid = req.params.id;

  try {
    const task = await Task.findOne({
      _id: taskid,
      owner: req.user._id,
    });
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    res.status(200).json({ task, message: "Task Fetched Successfully" });
  } catch (err) {
    res.status(500).send({ error: err });
  }
});

// update a task by id   -   description , completed
router.patch("/:id", auth, async (req, res) => {
  const taskid = req.params.id;
  const updates = Object.keys(req.body);
  // {
  //     description : "new description",
  //     completed: true,
  //     owner : "asfasfasfasfasf"
  // }
  const allowedUpdates = ["description", "completed"];
  const isValidOperation = updates.every((update) =>
    allowedUpdates.includes(update)
  );

  if (!isValidOperation) {
    return res.status(400).json({ error: "Invalid Updates" });
  }

  try {
    const task = await Task.findOne({
      _id: taskid,
      owner: req.user._id,
    });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    updates.forEach((update) => (task[update] = req.body[update]));
    await task.save();

    res.json({
      message: "Task Updated Successfully",
    });
  } catch (err) {
    res.status(500).send({ error: err });
  }
});

// delete a task by id
router.delete("/:id", auth, async (req, res) => {
  const taskid = req.params.id;

  try {
    const task = await Task.findOneAndDelete({
      _id: taskid,
      owner: req.user._id,
    });
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    res.status(200).json({ task, message: "Task Deleted Successfully" });
  } catch (err) {
    res.status(500).send({ error: err });
  }
});

router.delete("/", auth, async (req, res) => {
  try {
    // Find and delete all tasks for the authenticated user
    const result = await Task.deleteMany({ owner: req.user._id });

    res.status(200).json({
      message: `Deleted ${result.deletedCount} tasks for the user`,
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

//subtask
router.post("/:id/subtasks", auth, async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      owner: req.user._id,
    });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const newSubtask = {
      description: req.body.description,
      completed: req.body.completed || false,
    };

    task.subtasks.push(newSubtask);
    await task.save();
    updateTaskStatus(task);

    res.status(201).json({
      task,
      status: task.status,
      message: "Subtask Created Successfully",
    });
  } catch (err) {
    res.status(400).send({ error: err.message });
  }
});
const updateTaskStatus = (task) => {
  const allSubtasksCompleted = task.subtasks.every(
    (subtask) => subtask.completed
  );

  if (allSubtasksCompleted) {
    task.status = "DONE";
  } else if (task.subtasks.some((subtask) => subtask.completed)) {
    task.status = "IN_PROGRESS";
  } else {
    task.status = "TODO";
  }

  // Save the updated task
  task.save();
};

router.patch("/:taskId/subtasks/:subtaskId", auth, async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.taskId,
      owner: req.user._id,
    });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const subtask = task.subtasks.id(req.params.subtaskId);

    if (!subtask) {
      return res.status(404).json({ message: "Subtask not found" });
    }

    // Assuming subtask details are provided in req.body
    subtask.description = req.body.description || subtask.description;
    subtask.completed = req.body.completed || subtask.completed;

    await task.save();

    res.json({ task, message: "Subtask Updated Successfully" });
  } catch (err) {
    res.status(400).send({ error: err.message });
  }
});
router.delete("/:taskId/subtasks/:subtaskId", auth, async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.taskId,
      owner: req.user._id,
    });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    task.subtasks.id(req.params.subtaskId).remove();
    await task.save();

    res.json({ task, message: "Subtask Deleted Successfully" });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

module.exports = router;
