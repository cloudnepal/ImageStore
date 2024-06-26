import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { folder } from "jszip";
import { newFolder, getFolders, getFolderFolderRelation, getFolderAlbumRelation, deleteFolder, renameFolder, putFolderIntoFolder, putAlbumIntoFolder, getAlbums } from "../API";
import { AlbumT, FolderT } from "../Interfaces";

export function useFoldersQuery(folder?: string, searchTerm?: string, enabled = true) {
    const queryInfo = useQuery(["folders", "albums"], async () => {
        const foldersP = getFolders()
        const folderFolderArrP = getFolderFolderRelation()
        const folderAlbumArrP = getFolderAlbumRelation()
        const albumsP = await getAlbums("");

        const [folders, folderFolderArr, folderAlbumArr, albums] = (await Promise.all([foldersP, folderFolderArrP, folderAlbumArrP, albumsP])).map(o => o.data) as [FolderT[], { parentid: string, childid: string }[], { parentid: string, childid: string }[], AlbumT[]]

        const idMap: { [key: string]: FolderT } = folders.reduce((o, f) => ({ ...o, [f.id]: f }), {})
        const folderMap: { [key: string]: string[] } = {}
        const rootFolderSet: { [key: string]: true } = folders.reduce((o, f) => ({ ...o, [f.id]: true }), {})
        const rootAlbumSet: { [key: string]: true } = albums.reduce((o, f) => ({ ...o, [f.id]: true }), {})

        const parentMap: { [key: string]: string } = {}
        folderFolderArr.forEach(({ parentid, childid }) => {
            if (!(parentid in folderMap))
                folderMap[parentid] = []
            folderMap[parentid].push(childid)
            parentMap[childid] = parentid
            delete rootFolderSet[childid]
        })

        const albumMap: { [key: string]: string[] } = {}
        folderAlbumArr.forEach(({ parentid, childid }) => {
            if (!(parentid in albumMap))
                albumMap[parentid] = []
            albumMap[parentid].push(childid)
            delete rootAlbumSet[childid]
        })

        folderMap[""] = Object.keys(rootFolderSet).map((key) => key)
        albumMap[""] = Object.keys(rootAlbumSet).map((key) => Number(key) as any)

        return { idMap, folderMap, albumMap, parentMap, albums }
    }, { enabled });


    let newData;

    if (queryInfo.data) {
        const path: FolderT[] = []
        let cur = folder && queryInfo.data.idMap[folder]
        cur = cur && queryInfo.data.idMap[queryInfo.data?.parentMap[cur.id]]
        while (cur) {
            path.push(cur)
            cur = queryInfo.data.idMap[queryInfo.data?.parentMap[cur.id]]
        }
        path.reverse()

        newData = {
            folderInfo: folder ? queryInfo.data.idMap[folder] : undefined, // current folder
            foldersToShow: queryInfo.data.folderMap[folder ?? ""]?.map(f => queryInfo.data.idMap[f]).filter(o => !searchTerm || o.name.includes(searchTerm)), //folders in curent folder
            albumsToShow: (queryInfo.data.albums.filter(a => queryInfo.data.albumMap[folder ?? ""]?.includes(a.id))).filter(o => !searchTerm || o.name.includes(searchTerm)), //albums in current folder
            path, //path to current folder
            folderMap: queryInfo.data.folderMap, // map from folderId to child folderIds
            idMap: queryInfo.data.idMap //mapping from any id to the folder
        }
    }

    return {
        ...queryInfo,
        data: newData
    }
}

export function useNewFolderMutation() {
    const qc = useQueryClient()
    return useMutation(({ folderName, parentId }: { folderName: string, parentId?: string }) => newFolder(folderName, parentId), {
        onSuccess: (data, variables, context) => {
            qc.invalidateQueries(["folders"])
        }
    })
}

export function useDeleteFolderMutation() {
    const qc = useQueryClient()
    return useMutation(({ oid }: { oid: string }) => deleteFolder(oid), {
        onSuccess: (data, variables, context) => {
            qc.invalidateQueries(["folders"])
        }
    })
}

export function useRenameFolderMutation() {
    const qc = useQueryClient()
    return useMutation(({ oid, newName }: { oid: string, newName: string }) => renameFolder(oid, newName), {
        onSuccess: (data, variables, context) => {
            qc.invalidateQueries(["folders"])
        }
    })
}

export function useMoveFolderMutation() {
    const qc = useQueryClient()
    return useMutation(({ oid, parentOid }: { oid: string, parentOid?: string }) => putFolderIntoFolder(oid, parentOid), {
        onSuccess: (data, variables, context) => {
            qc.invalidateQueries(["folders"])
        }
    })
}

export function useMoveAlbumMutation() {
    const qc = useQueryClient()
    return useMutation(({ oid, parentOid }: { oid: string, parentOid?: string }) => putAlbumIntoFolder(oid, parentOid), {
        onSuccess: (data, variables, context) => {
            qc.invalidateQueries(["folders"])
        }
    })
}