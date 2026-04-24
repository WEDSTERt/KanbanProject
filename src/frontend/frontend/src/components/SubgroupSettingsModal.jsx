import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { GET_PROJECT_DETAILS } from '../graphql/queries';
import {
    UPDATE_SUBGROUP,
    ADD_SUBGROUP_MEMBER,
    UPDATE_SUBGROUP_MEMBER,
    REMOVE_SUBGROUP_MEMBER,
} from '../graphql/mutations';
import { useAuth } from '../contexts/AuthContext';
import ConfirmModal from './ConfirmModal';

const SubgroupSettingsModal = ({ subgroup, projectId, isOwner, onClose, onUpdate, onDelete }) => {

};

export default SubgroupSettingsModal;