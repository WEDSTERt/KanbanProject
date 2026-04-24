import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useQuery, useMutation } from '@apollo/client';
import { GET_TASK_ATTACHMENTS } from '../graphql/queries';
import { UPDATE_TASK } from '../graphql/mutations';
import AttachmentList from './AttachmentList';
import ConfirmModal from './ConfirmModal';

const TaskModal = ({
                       task,
                       subgroupId,
                       assignableUsers,
                       initialAssigneeIds,
                       onSave,
                       onDeleteTask,
                       isMyTasksGroup,
                       isCreator,
                       onClose
                   }) => {

};

export default TaskModal;