import  express  from "express";
import { getThumbnailbyId, getUsersThumbnials } from "../controllers/UserController.js";
import protect from "../middlewares/auth.js";

const UserRouter = express.Router();

UserRouter.get('/thumbnails', protect, getUsersThumbnials)
UserRouter.get('/thumbnails/:id', protect,  getThumbnailbyId)

export default UserRouter;
