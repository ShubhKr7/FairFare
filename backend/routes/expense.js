import express from 'express';
import {
    getUserFriendExpenses,
    createPersonalExpense,
    getPersonalExpenses,
    deletePersonalExpense,
    updatePersonalExpense,
    deleteExpense
} from '../controllers/expenses.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// Personal Expense Routes
router.post('/personal', auth, createPersonalExpense);
router.get('/personal', auth, getPersonalExpenses);
router.delete('/personal/:id', auth, deletePersonalExpense);
router.put('/personal/:id', auth, updatePersonalExpense);

// Generic Expense Delete Route (matches frontend DELETE /expenses/:id)
router.delete('/:id', auth, deleteExpense);

// Friend Expense Routes
router.get('/:currentUserId/:friendId', auth, getUserFriendExpenses);

export default router;