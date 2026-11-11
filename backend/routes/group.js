import express from 'express';
import {
    createGroup,
    getGroupDetails,
    getAllGroupsOfAUser,
    addMembers,
    addExpenseController,
    getUserTrips,
    getRecentExpenses,
    removeMembers,
    addafterDeleteExpenseController,
    deleteExpenseController,
    updateGroupExpenseController,
    getExpenseController,
    getTopCategoriesForGroupExpense,
    getSubCategoriesForGroup,
    getAllExpensesForASubcategoryInGroup,
    getGroupExpenses,
    updateGroupDetails,
    archiveGroup,
    unarchiveGroup,
    uploadGroupBanner,
    deleteGroupBanner,
} from '../controllers/groups.js';
import { auth } from '../middleware/auth.js';
import upload from '../middleware/multer.js';
const router = express.Router();

//GET requests
router.get('/get-group/:id', auth, getGroupDetails);
router.get("/:id/expenses", auth, getGroupExpenses);
router.get('/user-groups/:id', auth, getAllGroupsOfAUser);
router.get('/user/:userId/trips', auth, getUserTrips);
router.get('/user/:userId/recent-expenses', auth, getRecentExpenses);
router.get("/expense/:expenseId", auth, getExpenseController);
router.get("/:groupId/top-categories", auth, getTopCategoriesForGroupExpense);

//POST requests
router.post('/add-members/:id', auth, addMembers);
router.post('/remove-members/:id', auth, removeMembers);
router.post('/add-expense', auth, addExpenseController);
router.post('/create-group', auth, createGroup);
router.post("/del-add-expense", auth, addafterDeleteExpenseController);
router.post("/sub-categories", auth, getSubCategoriesForGroup);
router.post("/expenses-by-subcategory", auth, getAllExpensesForASubcategoryInGroup);

// PUT requests
router.put("/expense/:expenseId", auth, updateGroupExpenseController);
router.put("/update/:id", auth, updateGroupDetails);
router.put("/archive/:id", auth, archiveGroup);
router.put("/unarchive/:id", auth, unarchiveGroup);
router.put('/:id/banner', auth, upload.single('banner'), uploadGroupBanner);

// DELETE requests
router.delete("/del-expense/:expenseId", auth, deleteExpenseController);
router.delete('/:id/banner', auth, deleteGroupBanner);


export default router;