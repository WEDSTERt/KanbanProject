import React, { useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { GET_PROJECT_DETAILS, GET_USER_PROJECTS, GET_USERS } from '../graphql/queries';
import {
    UPDATE_PROJECT,
    ADD_PROJECT_MEMBER,
    UPDATE_MEMBER_ROLE,
    REMOVE_MEMBER,
    DELETE_PROJECT,
} from '../graphql/mutations';
import { useAuth } from '../contexts/AuthContext';
import ConfirmModal from './ConfirmModal';

const ProjectSettings = () => {

};

export default ProjectSettings;